import { Resend } from 'resend';

/**
 * Order-notification email, sent to the shop's own inboxes (not the customer) whenever a Cash on
 * Delivery order is placed — see api/orders/create.ts. Card orders are currently disabled on the
 * checkout UI, so this is the only path that fires for now; wiring a similar call into the
 * Safepay webhook's payment.succeeded branch is the natural next step if card checkout comes
 * back (kept fast there deliberately — see that file's doc comment).
 *
 * Never throws — a failed send must not fail order creation. Callers just fire-and-forget-ish
 * (await it, but ignore/log a false return) so a Resend outage never costs a customer their order.
 */

let cachedResend: Resend | null = null;
function resendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cachedResend) cachedResend = new Resend(apiKey);
  return cachedResend;
}

const NOTIFY_RECIPIENTS = ['portfoliowaqar@gmail.com', 'i.waqarahmed25@gmail.com'];

export interface OrderEmailItem {
  name: string;
  size: string;
  quantity: number;
  price: number;
}

export interface OrderEmailArgs {
  orderId: string;
  publicToken: string;
  paymentMethod: 'cash' | 'card';
  customer: {
    /** Optional — the checkout form only requires a phone number. */
    email?: string;
    phone: string;
    firstName: string;
    lastName: string;
    address: string;
    apartment?: string;
    city: string;
  };
  items: OrderEmailItem[];
  subtotal: number;
  shipping: number;
  total: number;
}

function formatPkr(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString('en-PK')}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function buildHtml(args: OrderEmailArgs): string {
  const rows = args.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(item.name)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(item.size)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatPkr(item.price * item.quantity)}</td>
        </tr>`
    )
    .join('');

  const orderNumber = args.orderId.slice(0, 8).toUpperCase();
  const addressLine = [args.customer.address, args.customer.apartment].filter(Boolean).join(', ');

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;">
      <h2 style="font-weight:400;">New Order — #${orderNumber}</h2>
      <p style="margin:0 0 16px;">Payment method: <strong>${args.paymentMethod === 'cash' ? 'Cash on Delivery' : 'Card'}</strong></p>

      <h3 style="font-weight:600;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">Shipping Details</h3>
      <table style="width:100%;font-size:14px;margin-bottom:16px;">
        <tr><td style="color:#666;width:120px;">Name</td><td>${escapeHtml(args.customer.firstName)} ${escapeHtml(args.customer.lastName)}</td></tr>
        <tr><td style="color:#666;">Phone</td><td>${escapeHtml(args.customer.phone)}</td></tr>
        ${args.customer.email ? `<tr><td style="color:#666;">Email</td><td>${escapeHtml(args.customer.email)}</td></tr>` : ''}
        <tr><td style="color:#666;">Address</td><td>${escapeHtml(addressLine)}</td></tr>
        <tr><td style="color:#666;">City</td><td>${escapeHtml(args.customer.city)}</td></tr>
      </table>

      <h3 style="font-weight:600;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;">Items</h3>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="text-align:left;">
            <th style="padding-bottom:8px;border-bottom:1px solid #111;">Item</th>
            <th style="padding-bottom:8px;border-bottom:1px solid #111;">Size</th>
            <th style="padding-bottom:8px;border-bottom:1px solid #111;text-align:center;">Qty</th>
            <th style="padding-bottom:8px;border-bottom:1px solid #111;text-align:right;">Price</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <table style="width:100%;font-size:14px;">
        <tr><td style="color:#666;">Subtotal</td><td style="text-align:right;">${formatPkr(args.subtotal)}</td></tr>
        <tr><td style="color:#666;">Shipping</td><td style="text-align:right;">${args.shipping === 0 ? 'Free' : formatPkr(args.shipping)}</td></tr>
        <tr><td style="font-weight:600;padding-top:8px;">Total</td><td style="text-align:right;font-weight:600;padding-top:8px;">${formatPkr(args.total)}</td></tr>
      </table>

      <p style="margin-top:24px;font-size:12px;color:#999;">Order ID: ${args.orderId}</p>
    </div>`;
}

/** Fire-and-forget: returns true if the send succeeded, false on any failure (logged, not thrown). */
export async function sendOrderNotificationEmail(args: OrderEmailArgs): Promise<boolean> {
  const resend = resendClient();
  if (!resend) {
    console.error('email: RESEND_API_KEY not set — skipping order notification email');
    return false;
  }

  const domain = process.env.RESEND_EMAIL_DOMAIN;
  const from = domain ? `RAR Studio Orders <orders@${domain}>` : 'RAR Studio Orders <onboarding@resend.dev>';

  try {
    const { error } = await resend.emails.send(
      {
        from,
        to: NOTIFY_RECIPIENTS,
        subject: `New Order #${args.orderId.slice(0, 8).toUpperCase()} — ${formatPkr(args.total)}`,
        html: buildHtml(args),
      },
      { idempotencyKey: `order-notification/${args.orderId}` }
    );
    if (error) {
      console.error('email: order notification send failed', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('email: order notification send threw', error);
    return false;
  }
}
