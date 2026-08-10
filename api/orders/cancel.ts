import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serviceClient, safepayConfig, applyTransition } from '../../server/paymentApi';

/**
 * Called from the /order/cancelled/:token page. Never trusts the browser's word alone that a
 * payment was cancelled — verifies against Safepay's reporter endpoint first. If the customer
 * actually completed payment and then hit the browser Back button (landing on cancel_url after
 * the fact), this runs the SUCCESS transition instead of cancelling a paid order.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Request body: { token: string } — the order's public_token.
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!token) {
    res.status(400).json({ code: 'BAD_REQUEST' });
    return;
  }

  const supabase = serviceClient();

  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, payment_status, safepay_tracker, amount_paid')
      .eq('public_token', token)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }

    if (order.payment_status !== 'awaiting_payment' || !order.safepay_tracker) {
      // Nothing to do — already resolved one way or another.
      res.status(200).json({ ok: true, paymentStatus: order.payment_status });
      return;
    }

    const config = safepayConfig();
    const reportRes = await fetch(`${config.apiHost}/reporter/api/v1/payments/${encodeURIComponent(order.safepay_tracker)}`, {
      headers: { Authorization: `Bearer ${config.secretKey}`, 'X-SFPY-MERCHANT-SECRET': config.secretKey },
    });

    let state: string | undefined;
    if (reportRes.ok) {
      const body = (await reportRes.json()) as { data?: { tracker?: { state?: string } } };
      state = body.data?.tracker?.state;
    }

    if (state === 'TRACKER_ENDED') {
      // The customer actually paid — never let an unauthenticated "cancel" call override that.
      const result = await applyTransition({
        orderId: order.id,
        current: 'awaiting_payment',
        eventType: 'payment.succeeded',
        data: {},
        amountPaidExisting: order.amount_paid,
      });
      res.status(200).json({ ok: true, paymentStatus: result.applied ? 'paid' : order.payment_status });
      return;
    }

    const result = await applyTransition({
      orderId: order.id,
      current: 'awaiting_payment',
      eventType: 'void.succeeded',
      data: {},
    });
    void result;

    // void.succeeded's allowedFrom includes 'paid', which is broader than we want here — cancel
    // should only ever move an order OUT of awaiting_payment, never touch a paid one. We already
    // handled the paid case above, so by construction we only reach here when current really was
    // awaiting_payment, making this call safe; still, don't rely on that subtlety elsewhere.
    res.status(200).json({ ok: true, paymentStatus: 'cancelled' });
  } catch (error) {
    console.error('orders/cancel: unexpected error', error);
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
}
