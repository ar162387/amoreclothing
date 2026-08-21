import type { CartItem } from '@/store/cartStore';
import { formatPrice } from '@/data/store';

/**
 * Shared "Checkout via WhatsApp" behavior — builds the same prefilled wa.me link from the
 * current cart contents everywhere the button appears (CartDrawer, ProductDetail), so it's
 * always exactly the same order summary regardless of which page it was triggered from.
 */

const WHATSAPP_NUMBER = '923001056929';

export function buildWhatsAppCheckoutUrl(items: CartItem[], totalPrice: number): string {
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

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${fullMessage}`;
}
