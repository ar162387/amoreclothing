import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderStatus, cancelOrder, type OrderStatusResponse } from '@/services/checkout';
import { useCartStore } from '@/store/cartStore';
import { Loader2 } from 'lucide-react';
import OrderReceipt from '@/components/OrderReceipt';

const PENDING_ORDER_KEY = 'amore-pending-order';
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 10;

const CLEARS_CART: readonly string[] = ['paid', 'on_delivery', 'refunded', 'partially_refunded'];

interface OrderStatusProps {
  mode: 'confirmation' | 'cancelled';
}

const OrderStatus = ({ mode }: OrderStatusProps) => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { clearCart } = useCartStore();
  const [status, setStatus] = useState<OrderStatusResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [pollsExhausted, setPollsExhausted] = useState(false);
  const cartClearedRef = useRef(false);
  const pollCountRef = useRef(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      if (mode === 'cancelled' && pollCountRef.current === 0) {
        await cancelOrder(token);
      }

      const result = await getOrderStatus(token);
      if (cancelled) return;

      if (!result) {
        setNotFound(true);
        return;
      }
      setStatus(result);

      if (result.pollAgain && pollCountRef.current < MAX_POLLS) {
        pollCountRef.current += 1;
        timer = setTimeout(load, POLL_INTERVAL_MS);
      } else if (result.pollAgain) {
        setPollsExhausted(true);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, mode]);

  useEffect(() => {
    if (!status || cartClearedRef.current) return;
    if (CLEARS_CART.includes(status.paymentStatus)) {
      cartClearedRef.current = true;
      clearCart();
      localStorage.removeItem(PENDING_ORDER_KEY);
    }
    // On failed/cancelled/expired/awaiting_payment, deliberately leave the cart untouched — a
    // failed or abandoned payment must never cost the customer their bag.
  }, [status, clearCart]);

  if (notFound) {
    return (
      <StatusShell>
        <h1 className="font-serif text-2xl font-light mb-3">We couldn't find that order</h1>
        <p className="text-sm text-muted-foreground mb-8">
          The link may be incorrect or expired. If you completed a payment, please contact us with your details.
        </p>
        <ActionLink onClick={() => navigate('/')}>Return Home</ActionLink>
      </StatusShell>
    );
  }

  if (!status) {
    return (
      <StatusShell>
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading your order…</p>
      </StatusShell>
    );
  }

  const orderNumber = status.orderId.slice(0, 8).toUpperCase();

  if (status.paymentStatus === 'awaiting_payment') {
    if (pollsExhausted) {
      return (
        <StatusShell>
          <h1 className="font-serif text-2xl font-light mb-3">Still confirming your payment</h1>
          <p className="text-sm text-muted-foreground mb-8">
            This is taking longer than usual. If you completed payment, it will be reflected shortly — please
            contact us with order #{orderNumber} if you need help sooner.
          </p>
        </StatusShell>
      );
    }
    return (
      <StatusShell>
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-6 text-muted-foreground" />
        <h1 className="font-serif text-2xl font-light mb-3">Confirming your payment…</h1>
        <p className="text-sm text-muted-foreground">Order #{orderNumber}</p>
      </StatusShell>
    );
  }

  if (status.paymentStatus === 'paid' || status.paymentStatus === 'on_delivery') {
    return <OrderReceipt status={status} onContinue={() => navigate('/')} />;
  }

  if (status.paymentStatus === 'failed') {
    return (
      <StatusShell>
        <h1 className="font-serif text-2xl font-light mb-3">Payment failed</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Your card was not charged. Your bag has been saved — you can try again below.
        </p>
        <ActionLink onClick={() => navigate('/checkout')}>Try Again</ActionLink>
      </StatusShell>
    );
  }

  if (status.paymentStatus === 'cancelled' || status.paymentStatus === 'expired') {
    return (
      <StatusShell>
        <h1 className="font-serif text-2xl font-light mb-3">Payment cancelled</h1>
        <p className="text-sm text-muted-foreground mb-8">Your bag is still saved — you can pick up where you left off.</p>
        <ActionLink onClick={() => navigate('/checkout')}>Return to Checkout</ActionLink>
      </StatusShell>
    );
  }

  if (status.paymentStatus === 'refunded' || status.paymentStatus === 'partially_refunded') {
    return <OrderReceipt status={status} onContinue={() => navigate('/')} />;
  }

  return null;
};

const StatusShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center px-6 max-w-md">{children}</div>
  </div>
);

const ActionLink = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-2 px-8 py-4 bg-foreground text-background text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
  >
    {children}
  </button>
);

export default OrderStatus;
