import type { FulfillmentStatus, PaymentStatus } from "@/shared/orderStatus.js";

/**
 * Tailwind badge classes for order statuses. Client-only (unlike src/shared/*, this may use the
 * `@/` alias freely — it's never imported from api/). Single source of truth, replacing the
 * duplicated statusColors map in AdminOrders.tsx and the separate getStatusBadgeClass switch in
 * AdminDashboard.tsx.
 */

const FULFILLMENT_BADGE_CLASSES: Record<FulfillmentStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  shipped: "bg-blue-100 text-blue-800",
  delivered: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export function getFulfillmentBadgeClass(status: FulfillmentStatus | string): string {
  return FULFILLMENT_BADGE_CLASSES[status as FulfillmentStatus] ?? "bg-gray-100 text-gray-800";
}

// Deliberately distinct palette from fulfillment so the two badges never read as one thing:
// on_delivery is intentionally quiet/muted (it's not really a "payment state" for COD orders),
// awaiting_payment reads as pending/in-progress, paid is the one truly "good" state, and refunds
// get their own purple family so they're never confused with a normal in-progress state.
const PAYMENT_BADGE_CLASSES: Record<PaymentStatus, string> = {
  on_delivery: "bg-slate-100 text-slate-600",
  awaiting_payment: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-500",
  expired: "bg-gray-100 text-gray-500",
  partially_refunded: "bg-purple-100 text-purple-800",
  refunded: "bg-purple-200 text-purple-900",
};

export function getPaymentBadgeClass(status: PaymentStatus | string): string {
  return PAYMENT_BADGE_CLASSES[status as PaymentStatus] ?? "bg-gray-100 text-gray-800";
}
