/**
 * Shared order status vocabulary. See src/shared/pricing.ts for the import rules that apply to
 * every file in this directory.
 *
 * Single source of truth for the fulfillment/payment status enums, replacing what used to be
 * six independent re-declarations (src/services/orders.ts x2, AdminOrders.tsx status colors +
 * filter options + update buttons, AdminDashboard.tsx's own switch statement).
 */

export const FULFILLMENT_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/**
 * Payment status is a SEPARATE axis from fulfillment status — a card order can be "paid" while
 * still "pending" fulfillment, or "delivered" while "refunded". Deliberately NOT coupled via a
 * DB constraint (see SQL/payments.sql) because a failed card order collected as COD must remain
 * a legal combination.
 */
export const PAYMENT_STATUSES = [
  "on_delivery",
  "awaiting_payment",
  "paid",
  "failed",
  "cancelled",
  "expired",
  "partially_refunded",
  "refunded",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  on_delivery: "On Delivery",
  awaiting_payment: "Awaiting Payment",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
  partially_refunded: "Partly Refunded",
  refunded: "Refunded",
};

export type PaymentMethod = "cash" | "card";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash on Delivery",
  card: "Card",
};
