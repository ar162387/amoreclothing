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

/** The hosted-checkout base URL — ground truth taken directly from @sfpy/node-core's own
 * createCheckoutUrl() source (node_modules/@sfpy/node-core/esm/Checkout.js), since this is
 * nowhere in Safepay's public docs. Deliberately NOT derived from SAFEPAY_HOSTS above:
 * production checkout lives on a completely different domain (getsafepay.com, no `api.`
 * subdomain) than the production API host, and sandbox's is `/embedded/`, not `/checkout/pay`
 * (a guess that shipped once and 500'd every real checkout attempt with "Required environment
 * is missing" — the checkout page rejects an unrecognized path outright). */
export const SAFEPAY_CHECKOUT_HOSTS = {
  sandbox: "https://sandbox.api.getsafepay.com/embedded/",
  production: "https://getsafepay.com/embedded/",
} as const;

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
