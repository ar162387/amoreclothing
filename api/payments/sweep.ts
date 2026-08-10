import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serviceClient, safepayConfig, applyTransition } from '../_lib/server';

/**
 * Cron sweeper (see vercel.json's "crons" entry, every 15 minutes). Catches orders stuck in
 * awaiting_payment for over an hour — a lost webhook plus a closed tab would otherwise leave a
 * permanent zombie row that never resolves. Reconciles each against Safepay directly; marks
 * `paid` if it actually completed, `expired` if it didn't. Capped at 50 per run.
 *
 * Guarded by CRON_SECRET, which Vercel automatically sends as `Authorization: Bearer
 * <CRON_SECRET>` on cron-triggered invocations — see
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
 */

const STALE_AFTER_MS = 60 * 60 * 1000;
const BATCH_LIMIT = 50;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const expectedAuth = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : undefined;
  if (expectedAuth && req.headers.authorization !== expectedAuth) {
    res.status(401).json({ code: 'UNAUTHORIZED' });
    return;
  }

  const supabase = serviceClient();
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();

  const { data: staleOrders, error } = await supabase
    .from('orders')
    .select('id, safepay_tracker, amount_paid')
    .eq('payment_status', 'awaiting_payment')
    .not('safepay_tracker', 'is', null)
    .lt('created_at', cutoff)
    .limit(BATCH_LIMIT);

  if (error) {
    console.error('payments/sweep: failed to query stale orders', error);
    res.status(500).json({ code: 'SERVER_ERROR' });
    return;
  }

  const config = safepayConfig();
  let paid = 0;
  let expired = 0;
  let skipped = 0;

  for (const order of staleOrders ?? []) {
    if (!order.safepay_tracker) continue;
    try {
      const reportRes = await fetch(
        `${config.apiHost}/reporter/api/v1/payments/${encodeURIComponent(order.safepay_tracker)}`,
        { headers: { Authorization: `Bearer ${config.secretKey}`, 'X-SFPY-MERCHANT-SECRET': config.secretKey } }
      );

      if (!reportRes.ok) {
        skipped++;
        continue;
      }
      const body = (await reportRes.json()) as {
        data?: { tracker?: { state?: string; payment_method?: { card_type?: string; last_four?: string } } };
      };
      const state = body.data?.tracker?.state;

      if (state === 'TRACKER_ENDED') {
        const result = await applyTransition({
          orderId: order.id,
          current: 'awaiting_payment',
          eventType: 'payment.succeeded',
          data: { payment_method: body.data?.tracker?.payment_method },
          amountPaidExisting: order.amount_paid,
        });
        if (result.applied) paid++;
      } else {
        const result = await applyTransition({
          orderId: order.id,
          current: 'awaiting_payment',
          eventType: 'internal.expire',
          data: {},
        });
        if (result.applied) expired++;
      }
    } catch (sweepError) {
      console.error(`payments/sweep: failed to reconcile order ${order.id}`, sweepError);
      skipped++;
    }
  }

  res.status(200).json({ ok: true, checked: staleOrders?.length ?? 0, paid, expired, skipped });
}
