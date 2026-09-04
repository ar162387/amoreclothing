import { supabase } from "@/integrations/supabase/client";
import type { PaymentStatus } from "@/shared/orderStatus";

/** PostgREST returns `numeric` columns as STRINGS, not numbers — always wrap in Number(...)
 * before doing arithmetic or a `=== 0` comparison. (This bit the admin's "Free" shipping label:
 * `order.shipping === 0` silently failed because `order.shipping` was the string `"0"`.) */

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  size: string;
  quantity: number;
  price: number;
  created_at?: string;
  // Join fields
  products?: {
    id: string;
    name: string;
    image_front: string | null;
  };
}

export interface Order {
  id: string;
  /** Optional — the checkout form only requires a phone number. */
  customer_email: string | null;
  customer_phone: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_address: string;
  customer_apartment: string | null;
  customer_city: string;
  payment_method: 'cash' | 'card';
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  subtotal: number;
  shipping: number;
  total: number;
  created_at?: string;
  updated_at?: string;
  item_count?: number; // Count of items for list view
  // Join fields
  order_items?: OrderItem[];

  // --- Payment fields (SQL/payments.sql) ---
  payment_status: PaymentStatus;
  payment_provider: string | null;
  safepay_tracker: string | null;
  safepay_environment: 'sandbox' | 'production' | null;
  currency: string;
  amount_paid: number | null;
  payment_fee: number | null;
  payment_net: number | null;
  card_brand: string | null;
  card_last4: string | null;
  charged_at: string | null;
  payment_failure_code: string | null;
  payment_failure_message: string | null;
  refunded_amount: number;
  refunded_at: string | null;
  public_token: string;
}

export interface PaymentEvent {
  id: string;
  order_id: string | null;
  provider: string;
  event_type: string;
  tracker: string | null;
  payload: Record<string, unknown>;
  signature_verified: boolean;
  received_at: string;
  processed_at: string | null;
  process_error: string | null;
}

export interface UpdateOrderStatusDTO {
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
}

export const ordersService = {
  async getOrders() {
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (ordersError || !orders) {
      return { data: null, error: ordersError };
    }

    // Get order items count for each order using a more efficient approach
    const orderIds = orders.map((o) => o.id);
    const { data: itemsData, error: itemsError } = await supabase
      .from("order_items")
      .select("order_id")
      .in("order_id", orderIds);

    if (itemsError) {
      return { data: orders.map((o) => ({ ...o, item_count: 0 })), error: null };
    }

    // Count items per order
    const itemCounts = itemsData?.reduce((acc, item) => {
      acc[item.order_id] = (acc[item.order_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const ordersWithItemCounts = orders.map((order) => ({
      ...order,
      item_count: itemCounts[order.id] || 0,
    }));

    return { data: ordersWithItemCounts, error: null };
  },

  async getOrderById(id: string) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderError) {
      return { data: null, error: orderError };
    }

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        *,
        products (
          id,
          name,
          image_front
        )
      `)
      .eq("order_id", id);

    if (itemsError) {
      return { data: null, error: itemsError };
    }

    return {
      data: { ...order, order_items: items } as Order,
      error: null,
    };
  },

  // Order creation moved server-side (api/orders/create.ts) — see src/services/checkout.ts.
  // The anon key never had an INSERT policy on `orders` once RLS tightened to authenticated-only,
  // so a direct client insert here could never actually succeed for a real (logged-out)
  // customer, and it trusted client-supplied prices besides. Removed rather than left dead, so
  // nobody reintroduces the client-priced insert by calling it.

  async updateOrderStatus(id: string, status: UpdateOrderStatusDTO['status']) {
    return await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
  },

  async getPaymentEvents(orderId: string) {
    return await supabase
      .from("payment_events")
      .select("id, order_id, provider, event_type, tracker, payload, signature_verified, received_at, processed_at, process_error")
      .eq("order_id", orderId)
      .order("received_at", { ascending: false });
  },
};
