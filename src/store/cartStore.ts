import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '@/services/products';

export interface CartItem {
  product: Product;
  quantity: number;
  size: string;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (product: Product, size: string) => void;
  removeItem: (productId: string, size: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number) => void;
  clearCart: () => void;
  /** Patches item.product.price in place for the given products. Called after the server
   * recomputes prices at checkout and finds a stale one (cart snapshots the whole product
   * object at add-to-cart time, so a price change since then never reaches an existing cart
   * item on its own). Minimal, targeted fix — it does not re-fetch or otherwise touch the rest
   * of the product. */
  syncPrices: (updates: { productId: string; price: number }[]) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      
      addItem: (product: Product, size: string) => {
        set((state) => {
          const existing = state.items.find(
            (item) => item.product.id === product.id && item.size === size
          );
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.product.id === product.id && item.size === size
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              ),
            };
          }
          return {
            items: [...state.items, { product, quantity: 1, size }],
          };
        });
      },
      
      removeItem: (productId: string, size: string) => {
        set((state) => ({
          items: state.items.filter(
            (item) => !(item.product.id === productId && item.size === size)
          ),
        }));
      },
      
      updateQuantity: (productId: string, size: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId, size);
          return;
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.product.id === productId && item.size === size
              ? { ...item, quantity }
              : item
          ),
        }));
      },
      
      clearCart: () => set({ items: [] }),

      syncPrices: (updates) => {
        const byId = new Map(updates.map((u) => [u.productId, u.price]));
        set((state) => ({
          items: state.items.map((item) =>
            byId.has(item.product.id)
              ? { ...item, product: { ...item.product, price: byId.get(item.product.id)! } }
              : item
          ),
        }));
      },
    }),
    {
      name: 'amore-cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

// Computed values as selectors
export const useCartTotalItems = () => useCartStore((state) => 
  state.items.reduce((sum, item) => sum + item.quantity, 0)
);

export const useCartTotalPrice = () => useCartStore((state) => 
  state.items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0)
);

// Helper to get computed values from store
export const getCartTotals = (items: CartItem[]) => ({
  totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
  totalPrice: items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0),
});
