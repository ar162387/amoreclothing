import { useState, useEffect } from 'react';
import { Search, Eye, ChevronDown, Copy, RefreshCw, ExternalLink } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { formatPrice } from '@/data/store';
import { ordersService, Order, PaymentEvent } from '@/services/orders';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getOptimizedImageUrl } from '@/lib/productImage';
import { getFulfillmentBadgeClass, getPaymentBadgeClass } from '@/lib/orderBadges';
import {
  FULFILLMENT_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type FulfillmentStatus,
} from '@/shared/orderStatus';
import { isRefundable, getRefundTarget } from '@/shared/refunds';

const AdminOrders = () => {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEvent[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      const { data, error } = await ordersService.getOrders();
      if (error) {
        toast.error('Failed to load orders');
        console.error(error);
      } else {
        setOrderList(data || []);
      }
      setLoading(false);
    };

    fetchOrders();
  }, []);

  const filteredOrders = orderList.filter((order) => {
    const fullName = `${order.customer_first_name} ${order.customer_last_name}`.toLowerCase();
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fullName.includes(searchQuery.toLowerCase()) ||
      order.customer_phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customer_email ?? '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || order.payment_status === paymentFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  const updateOrderStatus = async (orderId: string, newStatus: FulfillmentStatus) => {
    const { error } = await ordersService.updateOrderStatus(orderId, newStatus);
    if (error) {
      toast.error('Failed to update order status');
      console.error(error);
      return;
    }

    setOrderList((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );

    if (selectedOrder?.id === orderId) {
      const updatedOrder = { ...selectedOrder, status: newStatus };
      setSelectedOrder(updatedOrder);
    }

    toast.success(`Order status updated to ${newStatus}`);
  };

  const loadOrderDetails = async (orderId: string) => {
    const { data, error } = await ordersService.getOrderById(orderId);
    if (error) {
      toast.error('Failed to load order details');
      console.error(error);
      return;
    }
    if (data) {
      setSelectedOrder(data);
      const { data: events } = await ordersService.getPaymentEvents(orderId);
      setPaymentEvents(events ?? []);
    }
  };

  const syncPaymentStatus = async (orderId: string) => {
    if (!session?.access_token) {
      toast.error('Your session has expired — please log in again.');
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch('/api/orders/reconcile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ orderId }),
      });
      if (!res.ok) {
        toast.error('Failed to sync payment status');
        return;
      }
      toast.success('Payment status synced');
      await loadOrderDetails(orderId);
      const { data } = await ordersService.getOrders();
      if (data) setOrderList(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to sync payment status');
    } finally {
      setSyncing(false);
    }
  };

  const copyTracker = (tracker: string) => {
    navigator.clipboard.writeText(tracker).then(
      () => toast.success('Tracker copied'),
      () => toast.error('Could not copy tracker')
    );
  };

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-light mb-2">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Manage and track customer orders
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-background border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none px-4 py-3 pr-10 bg-background border border-border text-sm focus:outline-none focus:border-foreground"
          >
            <option value="all">All Status</option>
            {FULFILLMENT_STATUSES.map((status) => (
              <option key={status} value={status} className="capitalize">
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="appearance-none px-4 py-3 pr-10 bg-background border border-border text-sm focus:outline-none focus:border-foreground"
          >
            <option value="all">All Payments</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PAYMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-background border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="text-left text-xs font-medium uppercase tracking-wider p-4">
                  Order ID
                </th>
                <th className="text-left text-xs font-medium uppercase tracking-wider p-4">
                  Customer
                </th>
                <th className="text-left text-xs font-medium uppercase tracking-wider p-4">
                  Items
                </th>
                <th className="text-left text-xs font-medium uppercase tracking-wider p-4">
                  Total
                </th>
                <th className="text-left text-xs font-medium uppercase tracking-wider p-4">
                  Payment
                </th>
                <th className="text-left text-xs font-medium uppercase tracking-wider p-4">
                  Status
                </th>
                <th className="text-left text-xs font-medium uppercase tracking-wider p-4">
                  Date
                </th>
                <th className="text-right text-xs font-medium uppercase tracking-wider p-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 text-sm font-medium">
                    <span title={order.id}>{order.id.slice(0, 8).toUpperCase()}</span>
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {order.customer_first_name} {order.customer_last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                      {order.customer_email && (
                        <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {order.item_count || 0} item{(order.item_count || 0) !== 1 ? 's' : ''}
                  </td>
                  <td className="p-4 text-sm">{formatPrice(Number(order.total))}</td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {PAYMENT_METHOD_LABELS[order.payment_method]}
                      </p>
                      <span
                        className={`inline-flex px-2.5 py-0.5 text-xs uppercase tracking-wider ${getPaymentBadgeClass(
                          order.payment_status
                        )}`}
                      >
                        {PAYMENT_STATUS_LABELS[order.payment_status]}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex px-3 py-1 text-xs uppercase tracking-wider ${getFulfillmentBadgeClass(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => loadOrderDetails(order.id)}
                        className="p-2 hover:bg-muted transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No orders found.</p>
          </div>
        ) : null}
      </div>

      {/* Order Detail Dialog */}
      <Dialog
        open={!!selectedOrder}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
            setPaymentEvents([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-light">
              Order {selectedOrder?.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6 pt-4">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Customer
                  </p>
                  <p className="text-sm font-medium">
                    {selectedOrder.customer_first_name} {selectedOrder.customer_last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.customer_phone}</p>
                  {selectedOrder.customer_email && (
                    <p className="text-sm text-muted-foreground">{selectedOrder.customer_email}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Shipping Address
                  </p>
                  <p className="text-sm">
                    {selectedOrder.customer_address}
                    {selectedOrder.customer_apartment && (
                      <> <br />{selectedOrder.customer_apartment}</>
                    )}
                    <br />
                    {selectedOrder.customer_city}
                  </p>
                </div>
              </div>

              {/* Payment */}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Payment
                </p>
                <div className="border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{PAYMENT_METHOD_LABELS[selectedOrder.payment_method]}</p>
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs uppercase tracking-wider ${getPaymentBadgeClass(
                        selectedOrder.payment_status
                      )}`}
                    >
                      {PAYMENT_STATUS_LABELS[selectedOrder.payment_status]}
                    </span>
                  </div>

                  {selectedOrder.payment_method === 'card' && (
                    <div className="space-y-2 text-sm">
                      {selectedOrder.amount_paid !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount Paid</span>
                          <span>
                            {formatPrice(Number(selectedOrder.amount_paid))} {selectedOrder.currency}
                          </span>
                        </div>
                      )}
                      {(selectedOrder.payment_fee !== null || selectedOrder.payment_net !== null) && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Fee / Net</span>
                          <span>
                            {selectedOrder.payment_fee !== null ? formatPrice(Number(selectedOrder.payment_fee)) : '—'} /{' '}
                            {selectedOrder.payment_net !== null ? formatPrice(Number(selectedOrder.payment_net)) : '—'}
                          </span>
                        </div>
                      )}
                      {selectedOrder.card_brand && selectedOrder.card_last4 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Card</span>
                          <span>
                            {selectedOrder.card_brand} •••• {selectedOrder.card_last4}
                          </span>
                        </div>
                      )}
                      {selectedOrder.charged_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Charged At</span>
                          <span>{new Date(selectedOrder.charged_at).toLocaleString()}</span>
                        </div>
                      )}
                      {Number(selectedOrder.refunded_amount) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Refunded</span>
                          <span>
                            {formatPrice(Number(selectedOrder.refunded_amount))}
                            {selectedOrder.refunded_at ? ` on ${new Date(selectedOrder.refunded_at).toLocaleDateString()}` : ''}
                          </span>
                        </div>
                      )}
                      {selectedOrder.payment_status === 'failed' && (
                        <div className="text-red-600">
                          <p className="font-medium">
                            {selectedOrder.payment_failure_code ?? 'Payment failed'}
                          </p>
                          {selectedOrder.payment_failure_message && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {selectedOrder.payment_failure_message}
                            </p>
                          )}
                        </div>
                      )}
                      {selectedOrder.safepay_tracker && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Tracker</span>
                          <span className="flex items-center gap-2">
                            <code className="font-mono text-xs">{selectedOrder.safepay_tracker}</code>
                            <button
                              onClick={() => copyTracker(selectedOrder.safepay_tracker!)}
                              className="p-1 hover:bg-muted transition-colors"
                              title="Copy tracker"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2">
                        {(() => {
                          const target = isRefundable(selectedOrder)
                            ? getRefundTarget(selectedOrder)
                            : null;
                          // Only 'dashboard' mode exists today — the 'api' branch is a future
                          // drop-in (see src/shared/refunds.ts) with no UI yet.
                          return target && target.mode === 'dashboard' ? (
                            <a
                              href={target.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wider bg-muted hover:bg-foreground hover:text-background transition-colors"
                            >
                              Refund in Safepay <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null;
                        })()}
                        <button
                          onClick={() => syncPaymentStatus(selectedOrder.id)}
                          disabled={syncing}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wider bg-muted hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                          Sync payment status
                        </button>
                      </div>
                      {isRefundable(selectedOrder) && (
                        <p className="text-xs text-muted-foreground pt-1">
                          Refunds are processed in the Safepay dashboard. This order updates automatically once
                          Safepay confirms.
                        </p>
                      )}

                      {paymentEvents.length > 0 && (
                        <details className="pt-2">
                          <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer">
                            Payment timeline ({paymentEvents.length})
                          </summary>
                          <div className="mt-2 space-y-1">
                            {paymentEvents.map((event) => (
                              <div
                                key={event.id}
                                className={`flex justify-between text-xs py-1 ${
                                  event.event_type === 'internal.amount_mismatch'
                                    ? 'text-red-600 font-medium'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                <span>
                                  {event.event_type === 'internal.amount_mismatch' ? '⚠ ' : ''}
                                  {event.event_type}
                                </span>
                                <span>{new Date(event.received_at).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Order Items
                </p>
                <div className="space-y-3">
                  {selectedOrder.order_items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 py-3 border-b border-border"
                    >
                      {/* Product Image */}
                      {item.products?.image_front && (
                        <div className="w-16 h-20 bg-secondary shrink-0">
                          <img
                            src={getOptimizedImageUrl(item.products.image_front, 160)}
                            alt={item.products.name || 'Product'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {item.products?.name || 'Unknown Product'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Size: {item.size} • Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-medium shrink-0">
                        {formatPrice(Number(item.price) * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(Number(selectedOrder.subtotal))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>
                      {Number(selectedOrder.shipping) === 0 ? 'Free' : formatPrice(Number(selectedOrder.shipping))}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border font-medium">
                    <span>Total</span>
                    <span>{formatPrice(Number(selectedOrder.total))}</span>
                  </div>
                </div>
              </div>

              {/* Update Status */}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Update Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {FULFILLMENT_STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={() => updateOrderStatus(selectedOrder.id, status)}
                      className={`px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
                        selectedOrder.status === status
                          ? 'bg-foreground text-background'
                          : 'bg-muted hover:bg-foreground hover:text-background'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminOrders;
