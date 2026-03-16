import { useState, useEffect } from 'react';
import { Search, Eye, ChevronDown } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { formatPrice } from '@/data/store';
import { ordersService, Order } from '@/services/orders';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const statusColors: Record<Order['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  shipped: 'bg-blue-100 text-blue-800',
  delivered: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

const AdminOrders = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

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
      order.customer_email_or_phone.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
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
    }
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
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
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
                  <td className="p-4 text-sm font-medium">{order.id}</td>
                  <td className="p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {order.customer_first_name} {order.customer_last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{order.customer_email_or_phone}</p>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {order.item_count || 0} item{(order.item_count || 0) !== 1 ? 's' : ''}
                  </td>
                  <td className="p-4 text-sm">{formatPrice(Number(order.total))}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex px-3 py-1 text-xs uppercase tracking-wider ${
                        statusColors[order.status]
                      }`}
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
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-light">
              Order {selectedOrder?.id}
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
                  <p className="text-sm text-muted-foreground">{selectedOrder.customer_email_or_phone}</p>
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

              {/* Payment Method */}
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Payment Method
                </p>
                <p className="text-sm font-medium capitalize">
                  {selectedOrder.payment_method === 'cash' ? 'Cash on Delivery' : 'Card'}
                </p>
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
                            src={item.products.image_front}
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
                    <span>{selectedOrder.shipping === 0 ? 'Free' : formatPrice(Number(selectedOrder.shipping))}</span>
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
                  {(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as Order['status'][]).map(
                    (status) => (
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
                    )
                  )}
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
