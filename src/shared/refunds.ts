import type { PaymentMethod, PaymentStatus } from "./orderStatus.js";
import { SAFEPAY_DASHBOARD_HOSTS, type SafepayEnv } from "./safepay.js";

/**
 * The refund adapter. Safepay's only publicly documented refund mechanism today is the
 * merchant dashboard (Payments > All Payments > select transaction > Refund) — there is no
 * public REST refund endpoint. So today's RefundTarget is always `mode: 'dashboard'`: a deep
 * link the admin panel opens in a new tab, with the actual refund performed by the merchant in
 * Safepay's UI and synced back to us via the `payment.refunded` webhook.
 *
 * isRefundable() and getRefundTarget() are the ONLY two places refund policy lives. If Safepay
 * later confirms a real REST refund endpoint, change getRefundTarget() to return
 * `{mode:'api', endpoint}`, add api/payments/refund.ts, and the admin button's branch handles
 * the rest — no other file needs to change.
 *
 * See src/shared/pricing.ts for the import rules that apply to every file in this directory.
 */

export const REFUND_WINDOW_DAYS = 60;

export type RefundTarget =
  | { mode: "dashboard"; url: string; tracker: string }
  | { mode: "api"; endpoint: string };

export interface RefundableOrder {
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount_paid: number | null;
  refunded_amount: number | null;
  charged_at: string | null;
  safepay_tracker: string | null;
  safepay_environment: SafepayEnv | null;
}

export function isRefundable(order: RefundableOrder): boolean {
  if (order.payment_method !== "card") return false;
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") return false;
  if (!order.safepay_tracker) return false;
  if (!order.charged_at) return false;

  const chargedAt = new Date(order.charged_at).getTime();
  if (Number.isNaN(chargedAt)) return false;
  const daysSinceCharge = (Date.now() - chargedAt) / (1000 * 60 * 60 * 24);
  if (daysSinceCharge > REFUND_WINDOW_DAYS) return false;

  const amountPaid = order.amount_paid ?? 0;
  const refunded = order.refunded_amount ?? 0;
  return refunded < amountPaid;
}

export interface DashboardUrlTemplates {
  sandbox?: string;
  production?: string;
}

/**
 * Builds the deep link to the transaction in the Safepay dashboard. The exact per-transaction
 * URL shape is unverified (plan Step 0 / risk #5) — pass `templates` with a `{tracker}`
 * placeholder once sandbox recon confirms it; until then this falls back to the dashboard root
 * plus the tracker as a query param, which is not guaranteed to deep-link but is never wrong to
 * show (the admin can search the dashboard for the tracker either way, and the tracker is also
 * shown with a copy button in the modal as a fallback).
 */
export function getRefundTarget(
  order: Pick<RefundableOrder, "safepay_tracker" | "safepay_environment">,
  templates?: DashboardUrlTemplates
): RefundTarget | null {
  if (!order.safepay_tracker) return null;
  const env: SafepayEnv = order.safepay_environment ?? "sandbox";
  const template = templates?.[env];
  const url = template
    ? template.replace("{tracker}", order.safepay_tracker)
    : `${SAFEPAY_DASHBOARD_HOSTS[env]}/payments?tracker=${encodeURIComponent(order.safepay_tracker)}`;
  return { mode: "dashboard", url, tracker: order.safepay_tracker };
}
