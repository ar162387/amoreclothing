import { useState, useEffect } from 'react';
import { Package, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { formatPrice } from '@/data/store';
import { productsService } from '@/services/products';
import { ordersService, Order } from '@/services/orders';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    availableProducts: 0,
    pendingOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [productsResult, ordersResult] = await Promise.all([
          productsService.getProducts(),
          ordersService.getOrders(),
        ]);

        if (productsResult.error) {
          toast.error('Failed to load products');
          console.error(productsResult.error);
        }

        if (ordersResult.error) {
          toast.error('Failed to load orders');
          console.error(ordersResult.error);
        }

        const products = productsResult.data || [];
        const orders = ordersResult.data || [];

        // Calculate KPIs
        const totalProducts = products.length;
        const totalOrders = orders.length;
        const totalRevenue = orders
          .filter((o) => o.status === 'delivered')
          .reduce((sum, order) => sum + Number(order.total), 0);
        const availableProducts = products.filter((p) => p.available).length;
        const pendingOrders = orders.filter((o) => o.status === 'pending').length;

        setStats({
          totalProducts,
          totalOrders,
          totalRevenue,
          availableProducts,
          pendingOrders,
        });

        // Get recent 5 orders
        setRecentOrders(orders.slice(0, 5));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeClass = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'shipped':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const statsCards = [
    {
      label: 'Total Products',
      value: stats.totalProducts,
      icon: Package,
      change: `${stats.totalProducts} products`,
    },
    {
      label: 'Total Orders',
      value: stats.totalOrders,
      icon: ShoppingCart,
      change: `${stats.pendingOrders} pending`,
    },
    {
      label: 'Revenue',
      value: formatPrice(stats.totalRevenue),
      icon: DollarSign,
      change: `${stats.totalOrders} orders`,
    },
    {
      label: 'In Stock',
      value: `${stats.availableProducts}/${stats.totalProducts}`,
      icon: TrendingUp,
      change: `${stats.totalProducts - stats.availableProducts} out of stock`,
    },
  ];

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-light mb-2">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back! Here's an overview of your store.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat) => (
          <div key={stat.label} className="bg-background p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 bg-muted flex items-center justify-center">
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-light mb-1">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-xs text-muted-foreground mt-2">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-background border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="font-serif text-xl font-light">Recent Orders</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading orders...</div>
        ) : recentOrders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No orders yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left text-xs font-medium uppercase tracking-wider p-4">
                    Order ID
                  </th>
                  <th className="text-left text-xs font-medium uppercase tracking-wider p-4">
                    Customer
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-4 text-sm font-mono text-xs">{order.id.slice(0, 8)}...</td>
                    <td className="p-4 text-sm">
                      {order.customer_first_name} {order.customer_last_name}
                    </td>
                    <td className="p-4 text-sm">{formatPrice(Number(order.total))}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex px-3 py-1 text-xs uppercase tracking-wider ${getStatusBadgeClass(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {formatDate(order.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
