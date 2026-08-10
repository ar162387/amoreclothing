import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serviceClient, safepayConfig, applyTransition } from '../../server/paymentApi.js';

/**
 * Customer-facing order status, keyed by the unguessable `public_token` (never the raw order
 * id, and never via anon RLS — see SQL/payments.sql). Returns a deliberately WHITELISTED
 * projection: no address, no email/phone, no last name, no safepay_tracker, no fee/net, no
 * idempotency_key. A confirmation link forwarded to a friend, or sitting in someone's email,
 * must not leak the shipping address or hand out the payment tracker.
 *
 * Also does "reconcile-on-read": if the order is still awaiting_payment and has a tracker, it
 * checks Safepay's reporter endpoint directly. This is what makes the confirmation page correct
 * regardless of whether the webhook arrived before the redirect, after it, or was lost entirely
 * because the customer closed the tab — three of the trickiest edge cases in the whole feature,
 * solved by one mechanism.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) {
    res.status(400).json({ code: 'BAD_REQUEST' });
    return;
  }

  const supabase = serviceClient();

  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select(
        'id, public_token, payment_method, payment_status, status, subtotal, shipping, total, currency, amount_paid, card_brand, card_last4, charged_at, refunded_amount, safepay_tracker, created_at, customer_first_name'
      )
      .eq('public_token', token)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }

    let paymentStatus = order.payment_status as string;

    // Reconcile-on-read, guarded to a 60-minute window (matches the sweeper's expiry window).
    if (paymentStatus === 'awaiting_payment' && order.safepay_tracker) {
      const ageMs = Date.now() - new Date(order.created_at).getTime();
      if (ageMs < 60 * 60 * 1000) {
        try {
          const reconciled = await reconcile(order.id, order.safepay_tracker, order.amount_paid);
          if (reconciled) paymentStatus = reconciled;
        } catch (reconcileError) {
          // Degrade to "still confirming" rather than 500ing a customer's receipt page — a
          // Safepay outage should never look like our site is broken.
          console.error('orders/status: reconcile failed', reconcileError);
        }
      }
    }

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('size, quantity, price, products ( name, image_front )')
      .eq('order_id', order.id);

    if (itemsError) throw itemsError;

    res.status(200).json({
      orderId: order.id,
      firstName: order.customer_first_name,
      paymentMethod: order.payment_method,
      paymentStatus,
      fulfillmentStatus: order.status,
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping),
      total: Number(order.total),
      currency: order.currency,
      amountPaid: order.amount_paid !== null ? Number(order.amount_paid) : null,
      cardBrand: order.card_brand,
      cardLast4: order.card_last4,
      chargedAt: order.charged_at,
      refundedAmount: Number(order.refunded_amount ?? 0),
      items: (items ?? []).map((item) => ({
        name: (item.products as unknown as { name?: string } | null)?.name ?? 'Item',
        image: (item.products as unknown as { image_front?: string } | null)?.image_front ?? null,
        size: item.size,
        quantity: item.quantity,
        price: Number(item.price),
      })),
      pollAgain: paymentStatus === 'awaiting_payment',
    });
  } catch (error) {
    console.error('orders/status: unexpected error', error);
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
}

async function reconcile(orderId: string, tracker: string, amountPaidExisting: number | null): Promise<string | null> {
  const config = safepayConfig();
  const res = await fetch(`${config.apiHost}/reporter/api/v1/payments/${encodeURIComponent(tracker)}`, {
    headers: { Authorization: `Bearer ${config.secretKey}`, 'X-SFPY-MERCHANT-SECRET': config.secretKey },
  });
  if (!res.ok) return null;

  const body = (await res.json()) as {
    data?: {
      tracker?: {
        state?: string;
        payment_method?: { card_type?: string; last_four?: string };
      };
    };
  };
  const state = body.data?.tracker?.state;
  if (state !== 'TRACKER_ENDED') return null;

  const result = await applyTransition({
    orderId,
    current: 'awaiting_payment',
    eventType: 'payment.succeeded',
    data: {
      payment_method: body.data?.tracker?.payment_method,
    },
    amountPaidExisting,
  });

  return result.applied ? 'paid' : null;
}
