import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, ShoppingBag, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCartStore, getCartTotals } from '@/store/cartStore';
import { formatPrice } from '@/data/store';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

const CartDrawer = () => {
  const navigate = useNavigate();
  const { items, isOpen, closeCart, removeItem, updateQuantity } = useCartStore();
  const { totalItems, totalPrice } = getCartTotals(items);

  const handleCheckout = () => {
    const message = items
      .map(
        (item) =>
          `${item.product.name} (Size: ${item.size}) x${item.quantity} - ${formatPrice(
            Number(item.product.price) * item.quantity
          )}`
      )
      .join('\n');
    
    const fullMessage = encodeURIComponent(
      `Hello! I would like to place an order:\n\n${message}\n\nTotal: ${formatPrice(totalPrice)}`
    );
    
    window.open(`https://wa.me/923001234567?text=${fullMessage}`, '_blank');
    toast.success('Redirecting to WhatsApp...');
  };

  return (
    <Sheet open={isOpen} onOpenChange={closeCart}>
      <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="font-serif text-2xl font-light">Shopping Bag</SheetTitle>
          {totalItems > 0 && (
            <p className="text-sm text-muted-foreground">{totalItems} {totalItems === 1 ? 'item' : 'items'}</p>
          )}
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
            <ShoppingBag className="h-16 w-16 mb-6 text-muted-foreground" />
            <h2 className="font-serif text-2xl font-light mb-4">Your Bag is Empty</h2>
            <p className="text-sm text-muted-foreground mb-8">
              Discover our collection and add your favorite pieces.
            </p>
            <Link
              to="/collections"
              onClick={closeCart}
              className="inline-flex items-center gap-2 px-8 py-4 bg-foreground text-background text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
            >
              Shop Collection
            </Link>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-6">
              <div className="divide-y divide-border py-4">
                {items.map((item) => {
                  const imageSrc = item.product.image_front || '';

                  return (
                    <div
                      key={`${item.product.id}-${item.size}`}
                      className="py-4 flex gap-4"
                    >
                      {/* Image */}
                      <Link
                        to={`/product/${item.product.id}`}
                        onClick={closeCart}
                        className="w-20 h-28 bg-secondary shrink-0"
                      >
                        {imageSrc && (
                          <img
                            src={imageSrc}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </Link>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <Link
                            to={`/product/${item.product.id}`}
                            onClick={closeCart}
                            className="text-sm font-medium hover:underline flex-1"
                          >
                            {item.product.name}
                          </Link>
                          <button
                            onClick={() => removeItem(item.product.id, item.size)}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Size: {item.size}
                        </p>

                        <div className="flex items-center justify-between">
                          {/* Quantity */}
                          <div className="flex items-center border border-border">
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.size,
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
                                  item.quantity + 1
                                )
                              }
                              className="p-2 hover:bg-secondary transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <p className="text-sm font-medium">
                            {formatPrice(Number(item.product.price) * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Order Summary */}
            <div className="border-t p-6 space-y-4 bg-background">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{totalPrice >= 15000 ? 'Free' : formatPrice(500)}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between font-medium mb-4">
                  <span>Total</span>
                  <span>
                    {formatPrice(totalPrice >= 15000 ? totalPrice : totalPrice + 500)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleCheckout}
                  className="w-full py-4 bg-[#25D366] text-white text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
                >
                  Checkout via WhatsApp
                </button>
                <button
                  onClick={() => {
                    closeCart();
                    navigate('/checkout');
                  }}
                  className="w-full py-4 bg-foreground text-background text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
                >
                  Checkout
                </button>
              </div>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Free shipping on orders over PKR 15,000
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
