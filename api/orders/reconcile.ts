import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { serviceClient, safepayConfig, applyTransition } from '../../server/paymentApi';

/**
 * Powers the admin "Sync payment status" button, for when a webhook is missed. The only route
 * in this feature that requires auth: verifies the caller's Supabase access token. Note this
 * inherits the app's existing (weak) notion of "admin" — ProtectedRoute.tsx only checks that
 * *some* Supabase user is signed in, not a role — so this route does the same. Tightening that
 * is a separate piece of work (see the plan's risk #6); this route deliberately doesn't invent a
 * stronger bar than the rest of the admin panel already has.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
  if (!token) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const anonUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!anonUrl || !anonKey) {
    console.error('orders/reconcile: missing Supabase anon config for token verification');
    res.status(500).json({ code: 'SERVER_ERROR' });
    return;
  }
  const authClient = createClient(anonUrl, anonKey);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId : '';
  if (!orderId) {
    res.status(400).json({ code: 'BAD_REQUEST' });
    return;
  }

  const supabase = serviceClient();

  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, payment_status, safepay_tracker, amount_paid, refunded_amount')
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    if (!order.safepay_tracker) {
      res.status(200).json({ ok: true, paymentStatus: order.payment_status, note: 'no tracker on this order' });
      return;
    }

    const config = safepayConfig();
    const reportRes = await fetch(
      `${config.apiHost}/reporter/api/v1/payments/${encodeURIComponent(order.safepay_tracker)}`,
      { headers: { Authorization: `Bearer ${config.secretKey}`, 'X-SFPY-MERCHANT-SECRET': config.secretKey } }
    );

    if (!reportRes.ok) {
      res.status(502).json({ code: 'SAFEPAY_UNAVAILABLE' });
      return;
    }

    const body = (await reportRes.json()) as {
      data?: { tracker?: { state?: string; payment_method?: { card_type?: string; last_four?: string } } };
    };
    const state = body.data?.tracker?.state;

    if (state === 'TRACKER_ENDED') {
      const result = await applyTransition({
        orderId: order.id,
        current: order.payment_status,
        eventType: 'payment.succeeded',
        data: { payment_method: body.data?.tracker?.payment_method },
        amountPaidExisting: order.amount_paid,
      });
      res.status(200).json({ ok: true, paymentStatus: result.applied ? 'paid' : order.payment_status });
      return;
    }

    res.status(200).json({ ok: true, paymentStatus: order.payment_status, safepayState: state });
  } catch (error) {
    console.error('orders/reconcile: unexpected error', error);
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
}
