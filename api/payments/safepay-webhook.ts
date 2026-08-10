import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serviceClient, safepayConfig, readRawBody, verifySafepaySignature, sha256Hex, applyTransition } from '../_lib/server';
import { SAFEPAY_WEBHOOK_VERSION } from '../../src/shared/safepay';
import { toMinorUnits } from '../../src/shared/pricing';
import type { PaymentStatus } from '../../src/shared/orderStatus';

/**
 * Safepay webhook receiver. See api/_lib/server.ts's readRawBody() doc comment for the raw-body
 * reconstruction problem this works around — TODO once sandbox testing confirms which candidate
 * (`rawBody` vs `reserialized-body`) actually matches Safepay's signature: delete the other
 * candidate and this comment.
 *
 * Must acknowledge within 10s (200) or Safepay retries. We do a handful of fast DB round-trips
 * and nothing slow (no email, no image work) to stay well inside that budget.
 */

interface WebhookEnvelope {
  type: string;
  version: string;
  token?: string;
  merchant_api_key?: string;
  data?: Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).send('method not allowed');
    return;
  }

  let config: ReturnType<typeof safepayConfig>;
  try {
    config = safepayConfig();
  } catch (error) {
    console.error('safepay-webhook: config error', error);
    res.status(500).send('server misconfigured');
    return;
  }

  if (!config.webhookSecret) {
    console.error('safepay-webhook: SAFEPAY_WEBHOOK_SECRET is not set');
    res.status(500).send('server misconfigured');
    return;
  }

  const raw = readRawBody(req);
  const signatureHeader = firstHeader(req.headers['x-sfpy-signature']);
  const matchedCandidate = verifySafepaySignature(raw, signatureHeader, config.webhookSecret);

  const supabase = serviceClient();

  if (!matchedCandidate) {
    // Store for forensics, but never process an unverified payload.
    try {
      await supabase.from('payment_events').insert({
        event_type: 'internal.signature_failed',
        payload: safeParsedPayload(raw.parsed),
        signature_verified: false,
      });
    } catch (insertError) {
      console.error('safepay-webhook: failed to record signature failure', insertError);
    }
    res.status(401).send('invalid signature');
    return;
  }

  console.log(`safepay-webhook: signature matched candidate "${matchedCandidate}"`);

  const envelope = raw.parsed as WebhookEnvelope;

  if (envelope.merchant_api_key && envelope.merchant_api_key !== config.merchantApiKey) {
    res.status(401).send('merchant mismatch');
    return;
  }

  if (envelope.version !== SAFEPAY_WEBHOOK_VERSION) {
    // A version we don't understand — acknowledge so Safepay doesn't retry it for hours, but
    // record it in case it turns out to matter.
    await recordEvent(supabase, {
      eventType: envelope.type ?? 'unknown',
      eventToken: envelope.token,
      bodyHash: sha256Hex(matchedBuffer(raw, matchedCandidate)),
      tracker: extractTracker(envelope.data),
      payload: envelope,
      signatureVerified: true,
      processedAt: new Date().toISOString(),
      processError: `unhandled webhook version: ${envelope.version}`,
    });
    res.status(200).json({ ok: true, note: 'unhandled version' });
    return;
  }

  const bodyHash = sha256Hex(matchedBuffer(raw, matchedCandidate));

  try {
    // Idempotency: a row with this body hash that's already been PROCESSED is a true duplicate
    // (Safepay retry). A row that exists but was never processed (we crashed mid-handling last
    // time) must still be reprocessed — that's why this checks processed_at, not just existence.
    const { data: existingEvent } = await supabase
      .from('payment_events')
      .select('id, processed_at')
      .eq('provider', 'safepay')
      .eq('body_sha256', bodyHash)
      .maybeSingle();

    if (existingEvent?.processed_at) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    interface WebhookOrderRow {
      id: string;
      payment_status: PaymentStatus;
      total: number;
      amount_paid: number | null;
      refunded_amount: number | null;
    }

    const tracker = extractTracker(envelope.data);
    let orderId: string | null = null;
    let order: WebhookOrderRow | null = null;

    if (tracker) {
      const { data: found } = await supabase
        .from('orders')
        .select('id, payment_status, total, amount_paid, refunded_amount')
        .eq('safepay_tracker', tracker)
        .maybeSingle();
      if (found) {
        orderId = found.id;
        order = found as WebhookOrderRow;
      }
    }
    if (!order) {
      const metaOrderId = (envelope.data?.metadata as { order_id?: string } | undefined)?.order_id;
      if (metaOrderId) {
        const { data: found } = await supabase
          .from('orders')
          .select('id, payment_status, total, amount_paid, refunded_amount')
          .eq('id', metaOrderId)
          .maybeSingle();
        if (found) {
          orderId = found.id;
          order = found as WebhookOrderRow;
        }
      }
    }

    if (!order || !orderId) {
      // Orphan event — don't retry it for hours. Surface it via payment_events for manual review.
      await recordEvent(supabase, {
        eventType: envelope.type,
        eventToken: envelope.token,
        bodyHash,
        tracker,
        payload: envelope,
        signatureVerified: true,
        processedAt: new Date().toISOString(),
        processError: 'unmatched_tracker',
      });
      res.status(200).json({ ok: true, note: 'unmatched tracker' });
      return;
    }

    const result = await applyTransition({
      orderId,
      current: order.payment_status,
      eventType: envelope.type,
      data: envelope.data ?? {},
      amountPaidExisting: order.amount_paid,
      refundedAmountExisting: order.refunded_amount,
    });

    // Amount tripwire: if the amount Safepay reports doesn't match what we told them to charge,
    // still record the payment (money did move) but flag it loudly — this turns a silent
    // denomination error (e.g. 100x) into something visible in the admin panel immediately.
    const reportedAmount = envelope.data?.amount;
    if (envelope.type === 'payment.succeeded' && reportedAmount !== undefined) {
      const expectedMinor = toMinorUnits(order.total);
      const reportedMinor = Number(reportedAmount);
      if (Number.isFinite(reportedMinor) && reportedMinor !== expectedMinor) {
        await supabase.from('payment_events').insert({
          order_id: orderId,
          event_type: 'internal.amount_mismatch',
          tracker,
          payload: { expectedMinor, reportedMinor },
        });
      }
    }

    await recordEvent(supabase, {
      orderId,
      eventType: envelope.type,
      eventToken: envelope.token,
      bodyHash,
      tracker,
      payload: envelope,
      signatureVerified: true,
      processedAt: new Date().toISOString(),
      processError: result.applied ? undefined : result.note,
    });

    res.status(200).json({ ok: true, applied: result.applied });
  } catch (error) {
    console.error('safepay-webhook: processing error', error);
    // 500 so Safepay retries — safe, because the processed_at predicate above means a
    // crash-abandoned event row is reprocessed rather than silently skipped.
    res.status(500).send('processing error');
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function matchedBuffer(raw: ReturnType<typeof readRawBody>, label: string): Buffer {
  const candidate = raw.candidates.find((c) => c.label === label);
  return candidate ? candidate.buffer : Buffer.from(JSON.stringify(raw.parsed));
}

function extractTracker(data: Record<string, unknown> | undefined): string | undefined {
  if (!data) return undefined;
  const trackerField = data.tracker;
  if (typeof trackerField === 'string') return trackerField;
  if (trackerField && typeof trackerField === 'object' && 'token' in trackerField) {
    const token = (trackerField as { token?: unknown }).token;
    return typeof token === 'string' ? token : undefined;
  }
  return undefined;
}

function safeParsedPayload(parsed: unknown): Record<string, unknown> {
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : { raw: String(parsed) };
}

async function recordEvent(
  supabase: ReturnType<typeof serviceClient>,
  args: {
    orderId?: string;
    eventType: string;
    eventToken?: string;
    bodyHash: string;
    tracker?: string;
    payload: unknown;
    signatureVerified: boolean;
    processedAt?: string;
    processError?: string;
  }
) {
  await supabase.from('payment_events').upsert(
    {
      order_id: args.orderId ?? null,
      provider: 'safepay',
      event_type: args.eventType,
      event_token: args.eventToken ?? null,
      body_sha256: args.bodyHash,
      tracker: args.tracker ?? null,
      payload: args.payload,
      signature_verified: args.signatureVerified,
      processed_at: args.processedAt ?? null,
      process_error: args.processError ?? null,
    },
    { onConflict: 'provider,body_sha256' }
  );
}
