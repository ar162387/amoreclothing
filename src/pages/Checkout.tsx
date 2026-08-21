import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ChevronLeft } from 'lucide-react';
import { useCartStore, getCartTotals } from '@/store/cartStore';
import { formatPrice } from '@/data/store';
import { calcShipping } from '@/shared/pricing';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createOrder } from '@/services/checkout';

interface CheckoutFormData {
  emailOrPhone: string;
  firstName: string;
  lastName: string;
  address: string;
  apartment?: string;
  city: string;
  paymentMethod: 'cash' | 'card';
}

const PENDING_ORDER_KEY = 'amore-pending-order';
const PENDING_ORDER_MAX_AGE_MS = 30 * 60 * 1000;

interface PendingOrderMarker {
  publicToken: string;
  idempotencyKey: string;
  at: number;
}

function readPendingOrder(): PendingOrderMarker | null {
  try {
    const raw = localStorage.getItem(PENDING_ORDER_KEY);
    if (!raw) return null;
    const marker = JSON.parse(raw) as PendingOrderMarker;
    if (Date.now() - marker.at > PENDING_ORDER_MAX_AGE_MS) {
      localStorage.removeItem(PENDING_ORDER_KEY);
      return null;
    }
    return marker;
  } catch {
    return null;
  }
}

const Checkout = () => {
  const navigate = useNavigate();
  const { items, clearCart, removeItem, syncPrices } = useCartStore();
  const { totalItems, totalPrice } = getCartTotals(items);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PendingOrderMarker | null>(null);

  // Stable per-visit idempotency key. Regenerated only when there's no unresolved pending order
  // to resume — this is what makes a reload/back-navigation dedupe server-side instead of
  // creating a second order for the same submission.
  const idempotencyKeyRef = useRef<string>('');
  if (!idempotencyKeyRef.current) {
    const existing = readPendingOrder();
    idempotencyKeyRef.current = existing?.idempotencyKey ?? crypto.randomUUID();
  }

  useEffect(() => {
    setPendingOrder(readPendingOrder());
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    defaultValues: {
      paymentMethod: 'cash',
    },
  });

  const paymentMethod = watch('paymentMethod');
  const shippingCost = calcShipping(totalPrice);
  const finalTotal = totalPrice + shippingCost;

  const onSubmit = async (data: CheckoutFormData) => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createOrder({
        customer: {
          emailOrPhone: data.emailOrPhone,
          firstName: data.firstName,
          lastName: data.lastName,
          address: data.address,
          apartment: data.apartment || undefined,
          city: data.city,
        },
        paymentMethod: data.paymentMethod,
        items: items.map((item) => ({
          productId: item.product.id,
          size: item.size,
          quantity: item.quantity,
          clientPrice: Number(item.product.price),
        })),
        idempotencyKey: idempotencyKeyRef.current,
      });

      if (result.ok === false) {
        if (result.code === 'ITEM_UNAVAILABLE') {
          result.productIds.forEach((productId) => {
            const item = items.find((i) => i.product.id === productId);
            if (item) removeItem(item.product.id, item.size);
          });
          toast.error('Some items in your bag are no longer available and have been removed.');
          return;
        }
        if (result.code === 'PRICE_CHANGED') {
          syncPrices(result.prices);
          toast.error('Prices have been updated — please review your bag before continuing.');
          return;
        }
        toast.error('Failed to place order. Please try again.');
        return;
      }

      if (data.paymentMethod === 'cash') {
        localStorage.removeItem(PENDING_ORDER_KEY);
        clearCart();
        toast.success('Order placed successfully!');
        navigate(result.redirectTo ?? `/order/confirmation/${result.publicToken}`, { replace: true });
        return;
      }

      // Card: do NOT clear the cart here — if the payment fails or is cancelled, the customer
      // must not lose their bag. OrderStatus.tsx clears it only once payment actually succeeds.
      localStorage.setItem(
        PENDING_ORDER_KEY,
        JSON.stringify({
          publicToken: result.publicToken,
          idempotencyKey: idempotencyKeyRef.current,
          at: Date.now(),
        } satisfies PendingOrderMarker)
      );
      if (result.checkoutUrl) {
        setIsRedirecting(true);
        window.location.assign(result.checkoutUrl);
      } else {
        navigate(`/order/confirmation/${result.publicToken}`, { replace: true });
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center px-6">
          <div className="animate-pulse font-serif text-2xl font-light mb-3">Redirecting to secure payment…</div>
          <p className="text-sm text-muted-foreground">Please do not close this window.</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-light mb-4">Your cart is empty</h1>
          <button
            onClick={() => navigate('/')}
            className="text-sm underline"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-6 py-8 lg:py-12">
        {/* Back Link */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {pendingOrder && (
          <div className="mb-8 border border-border bg-secondary/50 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              You have a payment in progress from a previous attempt.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(`/order/confirmation/${pendingOrder.publicToken}`)}
                className="text-sm underline"
              >
                Check payment status
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(PENDING_ORDER_KEY);
                  idempotencyKeyRef.current = crypto.randomUUID();
                  setPendingOrder(null);
                }}
                className="text-sm underline text-muted-foreground"
              >
                Start over
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <h1 className="font-serif text-3xl lg:text-4xl font-light mb-8">
              Checkout
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Contact Information */}
              <div>
                <h2 className="text-lg font-medium mb-4">Contact Information</h2>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="emailOrPhone">Email or Phone *</Label>
                    <Input
                      id="emailOrPhone"
                      {...register('emailOrPhone', {
                        required: 'Email or phone is required',
                      })}
                      placeholder="your@email.com or +92 300 1056929"
                      className="mt-2"
                    />
                    {errors.emailOrPhone && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.emailOrPhone.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div>
                <h2 className="text-lg font-medium mb-4">Shipping Address</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        {...register('firstName', {
                          required: 'First name is required',
                        })}
                        placeholder="John"
                        className="mt-2"
                      />
                      {errors.firstName && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.firstName.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        {...register('lastName', {
                          required: 'Last name is required',
                        })}
                        placeholder="Doe"
                        className="mt-2"
                      />
                      {errors.lastName && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.lastName.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address">Address *</Label>
                    <Input
                      id="address"
                      {...register('address', {
                        required: 'Address is required',
                      })}
                      placeholder="Street address"
                      className="mt-2"
                    />
                    {errors.address && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.address.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="apartment">Apartment, suite, etc. (Optional)</Label>
                    <Input
                      id="apartment"
                      {...register('apartment')}
                      placeholder="Apartment, suite, etc."
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      {...register('city', {
                        required: 'City is required',
                      })}
                      placeholder="Lahore"
                      className="mt-2"
                    />
                    {errors.city && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.city.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <h2 className="text-lg font-medium mb-4">Payment Method</h2>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value) => {
                    setValue('paymentMethod', value as 'cash' | 'card');
                  }}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="cash"
                      id="cash"
                    />
                    <Label htmlFor="cash" className="font-normal cursor-pointer">
                      Cash on Delivery
                    </Label>
                  </div>
                  <div className="flex items-start space-x-2 opacity-50">
                    <RadioGroupItem
                      value="card"
                      id="card"
                      disabled
                      className="mt-1"
                    />
                    <div>
                      <Label htmlFor="card" className="font-normal cursor-not-allowed">
                        Card — Visa / Mastercard
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Coming soon.</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-6 bg-foreground text-background text-sm tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? 'Processing...' : 'Place Order'}
              </Button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-24">
              <h2 className="font-serif text-xl font-light mb-6">Order Summary</h2>

              {/* Cart Items */}
              <div className="space-y-4 mb-6">
                {items.map((item) => {
                  const imageSrc = item.product.image_front || '';

                  return (
                    <div
                      key={`${item.product.id}-${item.size}`}
                      className="flex gap-3"
                    >
                      {/* Image */}
                      <div className="w-16 h-20 bg-secondary shrink-0">
                        {imageSrc && (
                          <img
                            src={imageSrc}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium mb-1">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground mb-1">
                          Size: {item.size} × {item.quantity}
                        </p>
                        <p className="text-sm font-medium">
                          {formatPrice(Number(item.product.price) * item.quantity)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}</span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span>{formatPrice(finalTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
