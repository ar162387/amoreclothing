import { supabase } from "@/integrations/supabase/client";

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
  customer_email_or_phone: string;
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
}

export interface CreateOrderDTO {
  customer_email_or_phone: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_address: string;
  customer_apartment?: string;
  customer_city: string;
  payment_method: 'cash' | 'card';
  items: Array<{
    product_id: string;
    size: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
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

  async createOrder(orderData: CreateOrderDTO) {
    // Start a transaction by creating the order first
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_email_or_phone: orderData.customer_email_or_phone,
        customer_first_name: orderData.customer_first_name,
        customer_last_name: orderData.customer_last_name,
        customer_address: orderData.customer_address,
        customer_apartment: orderData.customer_apartment || null,
        customer_city: orderData.customer_city,
        payment_method: orderData.payment_method,
        subtotal: orderData.subtotal,
        shipping: orderData.shipping,
        total: orderData.total,
      })
      .select()
      .single();

    if (orderError || !order) {
      return { data: null, error: orderError };
    }

    // Insert order items
    const orderItems = orderData.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      // If items insert fails, we should ideally rollback, but Supabase doesn't support transactions
      // For now, we'll return an error
      return { data: null, error: itemsError };
    }

    // Fetch the complete order with items
    return await this.getOrderById(order.id);
  },

  async updateOrderStatus(id: string, status: UpdateOrderStatusDTO['status']) {
    return await supabase
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
  },
};
