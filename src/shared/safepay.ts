/**
 * Safepay provider constants — endpoints, event types, tracker states. No secrets live here
 * (those are process.env-only, read in server/paymentApi.ts). See src/shared/pricing.ts for the
 * import rules that apply to every file in this directory.
 */

export const SAFEPAY_HOSTS = {
  sandbox: "https://sandbox.api.getsafepay.com",
  production: "https://api.getsafepay.com",
} as const;

export type SafepayEnv = keyof typeof SAFEPAY_HOSTS;

/** Safepay sandbox dashboard, used to build the per-transaction refund deep link. Confirm the
 * exact transaction-detail URL shape during sandbox recon (plan Step 0) and update
 * getRefundTarget() in src/shared/refunds.ts accordingly — this constant is the fallback. */
export const SAFEPAY_DASHBOARD_HOSTS = {
  sandbox: "https://sandbox.api.getsafepay.com/dashboard",
  production: "https://dashboard.getsafepay.com",
} as const;

/** TRACKER_ENDED means the payment completed (captured). Everything else is not-yet-final. */
export const SAFEPAY_TRACKER_STATES = {
  STARTED: "TRACKER_STARTED",
  ENROLLED: "TRACKER_ENROLLED",
  AUTHORIZED: "TRACKER_AUTHORIZED",
  ENDED: "TRACKER_ENDED",
  REVERSED: "TRACKER_REVERSED",
  VOIDED: "TRACKER_VOIDED",
  PARTIAL_REFUND: "TRACKER_PARTIAL_REFUND",
} as const;

/** Webhook envelope `type` values we understand (events version 2.0.0). Anything else is logged
 * and acknowledged (200) without a state change — see planPaymentTransition(). */
export const SAFEPAY_WEBHOOK_EVENT_TYPES = [
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "authorization.succeeded",
  "authorization.reversed",
  "void.succeeded",
] as const;

export type SafepayWebhookEventType = (typeof SAFEPAY_WEBHOOK_EVENT_TYPES)[number];

export const SAFEPAY_WEBHOOK_VERSION = "2.0.0";
