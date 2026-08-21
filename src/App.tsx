import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SiteContentProvider } from "@/contexts/SiteContentContext";
import CartDrawer from "@/components/CartDrawer";
import Index from "./pages/Index";
import ProductDetail from "./pages/ProductDetail";
import ShippingReturns from "./pages/ShippingReturns";
import Contact from "./pages/Contact";
import Checkout from "./pages/Checkout";
import OrderStatus from "./pages/OrderStatus";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

import ScrollToTop from "@/components/ScrollToTop";

// Admin-only code (plus recharts and everything else only these pages need) is code-split out of the
// storefront's initial bundle — public visitors never download it, only whoever actually logs in.
const ProtectedRoute = lazy(() =>
  import("@/components/ProtectedRoute").then((m) => ({ default: m.ProtectedRoute }))
);
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCollections = lazy(() => import("./pages/admin/AdminCollections"));
const AdminFabricCare = lazy(() => import("./pages/admin/AdminFabricCare"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminSiteContent = lazy(() => import("./pages/admin/AdminSiteContent"));

const AdminFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Skeleton className="h-8 w-32" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <SiteContentProvider>
            <ScrollToTop />
            <CartDrawer />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/shipping-returns" element={<ShippingReturns />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/checkout" element={<Checkout />} />
              {/* Static (not lazy) imports — these are on the money path, and a lazy chunk that
                  fails to load after a successful charge would be a support ticket. */}
              <Route path="/order/confirmation/:token" element={<OrderStatus mode="confirmation" />} />
              <Route path="/order/cancelled/:token" element={<OrderStatus mode="cancelled" />} />
              <Route path="/login" element={<Login />} />

              <Route
                element={
                  <Suspense fallback={<AdminFallback />}>
                    <ProtectedRoute />
                  </Suspense>
                }
              >
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/products" element={<AdminProducts />} />
                <Route path="/admin/collections" element={<AdminCollections />} />
                <Route path="/admin/fabric-care" element={<AdminFabricCare />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/site-content" element={<AdminSiteContent />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </SiteContentProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
