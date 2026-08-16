import { Check, Printer } from 'lucide-react';
import { formatPrice } from '@/data/store';
import type { OrderStatusResponse } from '@/services/checkout';

/**
 * The full, printable order receipt shown after a successful checkout (card or COD) and on
 * refund states — replaces the old "two lines on a white page" confirmation. Doubles as the
 * document customers save/print/screenshot for their own records (e.g. to submit as proof of a
 * completed order transaction).
 */

interface OrderReceiptProps {
  status: OrderStatusResponse;
  onContinue: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  paid: 'Payment Successful',
  on_delivery: 'Cash on Delivery',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
};

const OrderReceipt = ({ status, onContinue }: OrderReceiptProps) => {
  const orderNumber = status.orderId.slice(0, 8).toUpperCase();
  const badgeLabel = STATUS_BADGE[status.paymentStatus] ?? 'Order Confirmed';
  const isCod = status.paymentMethod === 'cash';

  return (
    <div className="min-h-screen py-12 px-6 flex justify-center bg-secondary/30 print:bg-background print:py-0">
      <div className="w-full max-w-lg">
        {/* Print action — hidden on the printed page itself */}
        <div className="flex justify-end mb-4 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print / Save Receipt
          </button>
        </div>

        <div className="border border-border bg-background p-8 sm:p-10 print:border-0 print:p-0">
          {/* Header */}
          <div className="text-center mb-8">
            <img src="/logo.png" alt="RAR Studio" className="h-10 w-auto mx-auto mb-6 object-contain" />
            <div className="inline-flex items-center gap-2 border border-foreground px-4 py-1.5 mb-5 text-xs tracking-widest uppercase">
              <Check className="h-3.5 w-3.5" />
              {badgeLabel}
            </div>
            <h1 className="font-serif text-2xl font-light mb-2">Thank you, {status.firstName}</h1>
            <p className="text-sm text-muted-foreground">Your order has been confirmed.</p>
          </div>

          {/* Order meta */}
          <div className="grid grid-cols-2 gap-4 border-y border-border py-5 mb-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Order Number</p>
              <p className="font-medium">#{orderNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Date</p>
              <p className="font-medium">{formatDate(status.chargedAt ?? status.createdAt)}</p>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4 mb-6">
            {status.items.map((item, i) => (
              <div key={`${item.name}-${item.size}-${i}`} className="flex gap-3">
                <div className="w-16 h-20 bg-secondary shrink-0">
                  {item.image && (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Size: {item.size} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium whitespace-nowrap">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-border pt-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(status.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>{status.shipping === 0 ? 'Free' : formatPrice(status.shipping)}</span>
            </div>
            <div className="border-t border-border pt-2.5 flex justify-between font-medium text-base">
              <span>Total</span>
              <span>{formatPrice(status.total)}</span>
            </div>
            {status.refundedAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Refunded</span>
                <span>-{formatPrice(status.refundedAmount)}</span>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className="border-t border-border mt-6 pt-5 text-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Payment Method</p>
            {isCod ? (
              <p>Cash on Delivery — pay {formatPrice(status.total)} on arrival</p>
            ) : (
              <p>
                {status.cardBrand && status.cardLast4 ? `${status.cardBrand} •••• ${status.cardLast4}` : 'Card'}
                {status.amountPaid !== null && ` — ${formatPrice(status.amountPaid)} paid`}
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 print:hidden">
          Save or print this page — it's your receipt for order #{orderNumber}.
        </p>

        <div className="flex justify-center mt-6 print:hidden">
          <button
            onClick={onContinue}
            className="inline-flex items-center gap-2 px-8 py-4 bg-foreground text-background text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderReceipt;
