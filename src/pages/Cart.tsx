import { Link } from 'react-router-dom';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/data/store';
import { toast } from 'sonner';

// Import product images
import product1 from '@/assets/product-1.jpg';
import product2 from '@/assets/product-2.jpg';
import product3 from '@/assets/product-3.jpg';
import product4 from '@/assets/product-4.jpg';
import product5 from '@/assets/product-5.jpg';
import product6 from '@/assets/product-6.jpg';
import product7 from '@/assets/product-7.jpg';

const productImages: Record<string, string> = {
  'product-1': product1,
  'product-2': product2,
  'product-3': product3,
  'product-4': product4,
  'product-5': product5,
  'product-6': product6,
  'product-7': product7,
};

const Cart = () => {
  const { items, removeItem, updateQuantity, totalPrice } = useCart();

  const handleCheckout = () => {
    const message = items
      .map(
        (item) =>
          `${item.product.name} (${item.size} x ${item.quantity} - ${formatPrice(
            item.product.price * item.quantity
          )}`
      )
      .join('\n');
    
    const fullMessage = encodeURIComponent(
      `Hello! I would like to place an order:\n\n${message}\n\nTotal: ${formatPrice(totalPrice)}`
    );
    
    window.open(`https://wa.me/923001234567?text=${fullMessage}`, '_blank');
    toast.success('Redirecting to WhatsApp...');
  };

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-6 py-20 text-center">
          <ShoppingBag className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h1 className="font-serif text-3xl font-light mb-4">Your Bag is Empty</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Discover our collection and add your favorite pieces.
          </p>
          <Link
            to="/collections"
            className="inline-flex items-center gap-2 px-8 py-4 bg-foreground text-background text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
          >
            Shop Collection
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-6 py-8 lg:py-12">
        <h1 className="font-serif text-3xl lg:text-4xl font-light mb-8 lg:mb-12">
          Shopping Bag
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="divide-y divide-border">
              {items.map((item) => {
                const imageKey = item.product.images[0];
                const imageSrc = productImages[imageKey] || product1;

                return (
                  <div
                    key={`${item.product.id}-${item.size}-${item.color}`}
                    className="py-6 flex gap-6"
                  >
                    {/* Image */}
                    <Link
                      to={`/product/${item.product.id}`}
                      className="w-24 h-32 bg-secondary shrink-0"
                    >
                      <img
                        src={imageSrc}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </Link>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <Link
                          to={`/product/${item.product.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {item.product.name}
                        </Link>
                        <button
                          onClick={() => removeItem(item.product.id, item.size, item.color)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Size: {item.size}
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Color: {item.color}
                      </p>

                      <div className="flex items-center justify-between">
                        {/* Quantity */}
                        <div className="flex items-center border border-border">
                          <button
                            onClick={() =>
                              updateQuantity(
                                item.product.id,
                                item.size,
                                item.color,
                                item.quantity - 1
                              )
                            }
                            className="p-2 hover:bg-secondary transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-10 text-center text-sm">{item.quantity}</span>
                          <button
                            onClick={() =>
                              updateQuantity(
                                item.product.id,
                                item.size,
                                item.color,
                                item.quantity + 1
                              )
                            }
                            className="p-2 hover:bg-secondary transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <p className="text-sm font-medium">
                          {formatPrice(item.product.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-secondary p-6 lg:p-8 sticky top-24">
              <h2 className="font-serif text-xl font-light mb-6">Order Summary</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{totalPrice >= 15000 ? 'Free' : formatPrice(500)}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4 mb-6">
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>
                    {formatPrice(totalPrice >= 15000 ? totalPrice : totalPrice + 500)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-4 bg-foreground text-background text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
              >
                Checkout via WhatsApp
              </button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Free shipping on orders over PKR 15,000
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Cart;
