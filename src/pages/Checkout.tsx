import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ChevronLeft } from 'lucide-react';
import { useCartStore, getCartTotals } from '@/store/cartStore';
import { formatPrice } from '@/data/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ordersService } from '@/services/orders';

interface CheckoutFormData {
  emailOrPhone: string;
  firstName: string;
  lastName: string;
  address: string;
  apartment?: string;
  city: string;
  paymentMethod: 'cash' | 'card';
}

const Checkout = () => {
  const navigate = useNavigate();
  const { items, clearCart } = useCartStore();
  const { totalItems, totalPrice } = getCartTotals(items);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const onSubmit = async (data: CheckoutFormData) => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderData = {
        customer_email_or_phone: data.emailOrPhone,
        customer_first_name: data.firstName,
        customer_last_name: data.lastName,
        customer_address: data.address,
        customer_apartment: data.apartment || undefined,
        customer_city: data.city,
        payment_method: data.paymentMethod,
        items: items.map((item) => ({
          product_id: item.product.id,
          size: item.size,
          quantity: item.quantity,
          price: Number(item.product.price),
        })),
        subtotal: totalPrice,
        shipping: shippingCost,
        total: finalTotal,
      };

      const { data: order, error } = await ordersService.createOrder(orderData);

      if (error) {
        console.error('Order creation error:', error);
        toast.error('Failed to place order. Please try again.');
        return;
      }

      toast.success('Order placed successfully!');
      
      // Clear cart and redirect
      clearCart();
      navigate('/');
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-light mb-4">Your cart is empty</h1>
          <button
            onClick={() => navigate('/collections')}
            className="text-sm underline"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  const shippingCost = totalPrice >= 15000 ? 0 : 500;
  const finalTotal = totalPrice + shippingCost;

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
                      placeholder="your@email.com or +92 300 1234567"
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
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="card"
                      id="card"
                      disabled
                    />
                    <Label htmlFor="card" className="font-normal cursor-pointer text-muted-foreground">
                      Card (Coming Soon!)
                    </Label>
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
