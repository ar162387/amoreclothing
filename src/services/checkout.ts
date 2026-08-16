/**
 * Thin fetch wrapper over the server-authoritative order-creation/status API
 * (api/orders/create.ts, api/orders/status.ts, api/orders/cancel.ts). Keeps Checkout.tsx and
 * OrderStatus.tsx free of fetch/error-shape plumbing — they just call these and switch on `ok`.
 */

export interface CheckoutCustomer {
  emailOrPhone: string;
  firstName: string;
  lastName: string;
  address: string;
  apartment?: string;
  city: string;
}

export interface CheckoutItem {
  productId: string;
  size: string;
  quantity: number;
  /** Informational only — see api/orders/create.ts. Never used to compute totals. */
  clientPrice?: number;
}

export interface CreateOrderRequest {
  customer: CheckoutCustomer;
  paymentMethod: 'cash' | 'card';
  items: CheckoutItem[];
  idempotencyKey: string;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; publicToken: string; redirectTo?: string; checkoutUrl?: string }
  | { ok: false; code: 'ITEM_UNAVAILABLE'; productIds: string[] }
  | { ok: false; code: 'PRICE_CHANGED'; prices: { productId: string; price: number }[] }
  | { ok: false; code: 'PAYMENT_INIT_FAILED' | 'BAD_REQUEST' | 'SERVER_ERROR' | 'NETWORK_ERROR' };

export async function createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
  try {
    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      return { ok: true, orderId: body.orderId, publicToken: body.publicToken, redirectTo: body.redirectTo, checkoutUrl: body.checkoutUrl };
    }
    if (res.status === 409 && body.code === 'ITEM_UNAVAILABLE') {
      return { ok: false, code: 'ITEM_UNAVAILABLE', productIds: body.productIds ?? [] };
    }
    if (res.status === 409 && body.code === 'PRICE_CHANGED') {
      return { ok: false, code: 'PRICE_CHANGED', prices: body.prices ?? [] };
    }
    if (res.status === 502) {
      return { ok: false, code: 'PAYMENT_INIT_FAILED' };
    }
    if (res.status === 400) {
      return { ok: false, code: 'BAD_REQUEST' };
    }
    return { ok: false, code: 'SERVER_ERROR' };
  } catch {
    return { ok: false, code: 'NETWORK_ERROR' };
  }
}

export interface OrderStatusItem {
  name: string;
  image: string | null;
  size: string;
  quantity: number;
  price: number;
}

export interface OrderStatusResponse {
  orderId: string;
  firstName: string;
  paymentMethod: 'cash' | 'card';
  paymentStatus: string;
  fulfillmentStatus: string;
  createdAt: string;
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  amountPaid: number | null;
  cardBrand: string | null;
  cardLast4: string | null;
  chargedAt: string | null;
  refundedAmount: number;
  items: OrderStatusItem[];
  pollAgain: boolean;
}

export async function getOrderStatus(token: string): Promise<OrderStatusResponse | null> {
  try {
    const res = await fetch(`/api/orders/status?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as OrderStatusResponse;
  } catch {
    return null;
  }
}

export async function cancelOrder(token: string): Promise<void> {
  try {
    await fetch('/api/orders/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Best-effort — the status page still reconciles-on-read even if this fails.
  }
}
