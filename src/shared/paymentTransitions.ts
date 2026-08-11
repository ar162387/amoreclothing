import type { PaymentStatus } from "./orderStatus.js";
import { fromMinorUnits } from "./pricing.js";

/**
 * Monotonic payment-status state machine, shared by api/payments/safepay-webhook.ts and the
 * reconcile-on-read path in api/orders/status.ts (and the sweeper / admin reconcile route) so
 * they can never disagree about what a given event means. See src/shared/pricing.ts for the
 * import rules that apply to every file in this directory.
 *
 * Every transition is applied by the caller as a GUARDED update:
 *   .update(patch).eq('id', orderId).in('payment_status', allowedFrom)
 * That's optimistic concurrency without a real transaction — it's what makes a webhook and a
 * reconcile-on-read racing each other safe: whichever writes first wins, and the loser's write
 * simply matches zero rows (a legitimate no-op), because by then payment_status is no longer in
 * `allowedFrom`.
 */

const RANK: Record<PaymentStatus, number> = {
  on_delivery: 0,
  awaiting_payment: 0,
  cancelled: 1,
  expired: 1,
  failed: 1,
  paid: 2,
  partially_refunded: 3,
  refunded: 4,
};

export interface TransitionInput {
  current: PaymentStatus;
  eventType: string;
  /** Event-specific fields from the webhook payload's `data`, or the reporter-endpoint response
   * when called from reconcile-on-read. Loosely typed because the two callers pass slightly
   * different shapes and we only read specific known keys defensively below. */
  data: Record<string, unknown>;
  /** Needed to compute refunded_amount when a payment.refunded event arrives. */
  amountPaidExisting?: number | null;
  /** The order's refunded_amount BEFORE this event — needed to accumulate correctly when
   * falling back to the incremental `refund_amount` field (i.e. no `balance` in the payload). */
  refundedAmountExisting?: number | null;
}

export interface TransitionResult {
  /** Fields to patch onto the order row, or null if this event should be a no-op (e.g. an
   * authorization event under mode:'payment', or an event type we don't understand). */
  patch: Record<string, unknown> | null;
  /** payment_status values FROM which this transition is allowed to apply. The caller must use
   * this as `.in('payment_status', allowedFrom)` in the guarded update. */
  allowedFrom: PaymentStatus[];
  note?: string;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Every money field Safepay sends us — `amount`, `fee`, `net`, `balance`, `refund_amount` — is
 * in the same lowest-denomination (paisa) convention documented for session creation (confirmed
 * against the live sandbox checkout page: we sent 1225000 and it rendered "Rs.12,250.00"). Our
 * `orders` table stores every money column in whole PKR, matching subtotal/shipping/total, so
 * every incoming Safepay amount must be converted at this boundary — nowhere else. Getting this
 * wrong looks exactly like what shipped once already: amount_paid off by 100x in the admin UI. */
function numMinor(value: unknown): number | null {
  const n = num(value);
  return n === null ? null : fromMinorUnits(n);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function planPaymentTransition(input: TransitionInput): TransitionResult {
  const { current, eventType, data } = input;

  switch (eventType) {
    case "payment.succeeded": {
      // A late success must be able to rescue an order the sweeper already marked expired, or
      // one a stray payment.failed marked failed — Safepay's own state is authoritative.
      if (RANK[current] >= RANK.paid) {
        return { patch: null, allowedFrom: [], note: "already at or past paid" };
      }
      const patch: Record<string, unknown> = {
        payment_status: "paid",
        charged_at: str(data.charged_at) ?? new Date().toISOString(),
      };
      const amount = numMinor(data.amount);
      if (amount !== null) patch.amount_paid = amount;
      const fee = numMinor(data.fee);
      if (fee !== null) patch.payment_fee = fee;
      const net = numMinor(data.net);
      if (net !== null) patch.payment_net = net;
      const paymentMethod = data.payment_method as { card_type?: unknown; last_four?: unknown } | undefined;
      if (paymentMethod && typeof paymentMethod === "object") {
        const brand = str(paymentMethod.card_type);
        const last4 = str(paymentMethod.last_four);
        if (brand) patch.card_brand = brand;
        if (last4) patch.card_last4 = last4;
      }
      return {
        patch,
        allowedFrom: ["awaiting_payment", "failed", "cancelled", "expired"],
      };
    }

    case "payment.failed": {
      // allowedFrom is deliberately narrow to ONLY awaiting_payment — this is the guard that
      // stops a late, out-of-order payment.failed from downgrading an order that a
      // payment.succeeded (processed first) already marked paid.
      return {
        patch: {
          payment_status: "failed",
          payment_failure_code: str(data.code) ?? undefined,
          payment_failure_message: str(data.message) ?? undefined,
        },
        allowedFrom: ["awaiting_payment"],
      };
    }

    case "payment.refunded": {
      if (current !== "paid" && current !== "partially_refunded" && current !== "refunded") {
        return { patch: null, allowedFrom: [], note: "not in a refundable state" };
      }
      const amountPaid = input.amountPaidExisting ?? 0;
      const balance = numMinor(data.balance);
      const refundAmount = numMinor(data.refund_amount);
      // Prefer `balance` (absolute remaining amount) when present — it's correct across
      // multiple sequential partial refunds regardless of whether refund_amount is incremental
      // or cumulative. Fall back to accumulating refund_amount onto what was already refunded,
      // which is only correct if refund_amount is per-event incremental (unverified — plan
      // risk #5; verify with two sequential partial refunds in sandbox before trusting this).
      let refundedAmount: number;
      if (balance !== null) {
        refundedAmount = Math.max(0, amountPaid - balance);
      } else if (refundAmount !== null) {
        refundedAmount = (input.refundedAmountExisting ?? 0) + refundAmount;
      } else {
        return { patch: null, allowedFrom: [], note: "refund event missing balance and refund_amount" };
      }
      const nextStatus: PaymentStatus = refundedAmount >= amountPaid && amountPaid > 0 ? "refunded" : "partially_refunded";
      return {
        patch: {
          payment_status: nextStatus,
          refunded_amount: refundedAmount,
          refunded_at: str(data.refunded_at) ?? new Date().toISOString(),
        },
        allowedFrom: ["paid", "partially_refunded", "refunded"],
      };
    }

    case "void.succeeded": {
      return {
        patch: { payment_status: "cancelled" },
        allowedFrom: ["awaiting_payment", "paid"],
      };
    }

    // Internal event types (not from Safepay) — synthesized by our own routes rather than a
    // webhook payload, but run through the same guarded state machine so they can't race unsafely
    // against a real webhook either.
    case "internal.expire": {
      // The sweeper's verdict after confirming with Safepay's reporter endpoint that a
      // long-stale awaiting_payment order never actually completed. Deliberately its own status
      // (not 'cancelled') — nobody cancelled it, it just timed out.
      return {
        patch: { payment_status: "expired" },
        allowedFrom: ["awaiting_payment"],
      };
    }

    case "authorization.succeeded":
    case "authorization.reversed":
      // We use mode:'payment' (immediate capture), so these shouldn't fire in normal operation.
      // Log and acknowledge rather than treat as an error.
      return { patch: null, allowedFrom: [], note: `unexpected event under mode:payment: ${eventType}` };

    default:
      return { patch: null, allowedFrom: [], note: `unhandled event type: ${eventType}` };
  }
}
