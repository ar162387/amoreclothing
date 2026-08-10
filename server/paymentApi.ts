import type { VercelRequest } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { planPaymentTransition, type TransitionInput } from '../src/shared/paymentTransitions';
import type { PaymentStatus } from '../src/shared/orderStatus';
import { SAFEPAY_HOSTS, type SafepayEnv } from '../src/shared/safepay';

/**
 * Shared server-side helpers for the payment API routes.
 *
 * Lives OUTSIDE api/ entirely (not api/_lib/) — a leading-underscore directory under api/ looks
 * like the standard "exclude this from routing" trick, but on Vercel it also excludes the file
 * from the deployed function bundle outright: every api/*.ts that imported '../_lib/server'
 * 500'd in production with `ERR_MODULE_NOT_FOUND`, even though the exact same relative-import-
 * from-outside-api/ pattern (`../../src/shared/*`) works fine. Mirrors how src/shared/* already
 * works for code shared with the client — this is that same pattern for code that's server-only
 * (uses node:crypto, a service-role Supabase client) and therefore must NOT live under src/,
 * which tsconfig.app.json (the browser/Vite build) type-checks with browser lib types only.
 *
 * Same `process.env` / relative-import conventions as the existing api/*.ts files (see
 * api/sitemap.ts, api/prerender.ts) — `@/` does not resolve here.
 */

// ---------------------------------------------------------------------------
// Supabase service-role client
// ---------------------------------------------------------------------------

let cachedServiceClient: SupabaseClient | null = null;

/** Full-RLS-bypass client for order writes. Never expose SUPABASE_SERVICE_ROLE_KEY to the
 * browser (it must never carry a VITE_ prefix — see .env). Cached across warm invocations. */
export function serviceClient(): SupabaseClient {
  if (cachedServiceClient) return cachedServiceClient;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  cachedServiceClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedServiceClient;
}

// ---------------------------------------------------------------------------
// Safepay config
// ---------------------------------------------------------------------------

export interface SafepayConfig {
  environment: SafepayEnv;
  apiHost: string;
  checkoutHost: string;
  merchantApiKey: string;
  secretKey: string;
  webhookSecret: string | undefined;
}

export function safepayConfig(): SafepayConfig {
  const environment = (process.env.SAFEPAY_ENVIRONMENT === 'production' ? 'production' : 'sandbox') as SafepayEnv;
  const apiHost = process.env.SAFEPAY_API_HOST ?? SAFEPAY_HOSTS[environment];
  const checkoutHost = process.env.SAFEPAY_CHECKOUT_HOST ?? `${apiHost}/checkout/pay`;
  const merchantApiKey = process.env.SAFEPAY_MERCHANT_API_KEY;
  const secretKey = process.env.SAFEPAY_SECRET_KEY;
  if (!merchantApiKey || !secretKey) {
    throw new Error('Missing SAFEPAY_MERCHANT_API_KEY or SAFEPAY_SECRET_KEY');
  }
  return {
    environment,
    apiHost,
    checkoutHost,
    merchantApiKey,
    secretKey,
    webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET,
  };
}

// ---------------------------------------------------------------------------
// Origin allowlisting — for redirect_url/cancel_url so preview deploys work
// ---------------------------------------------------------------------------

/** Derives the origin to redirect back to after a card payment, allowlisted against SITE_URL's
 * host and any *.vercel.app preview deployment host. Falls back to SITE_URL. This is what makes
 * testing on a Vercel preview deployment actually redirect back to that preview instead of
 * production — a hardcoded SITE_URL alone would send every sandbox test to the live site. */
export function siteOrigin(req: VercelRequest): string {
  const configuredSiteUrl = process.env.SITE_URL ?? 'http://localhost:5173';
  let configuredHost: string;
  try {
    configuredHost = new URL(configuredSiteUrl).host;
  } catch {
    configuredHost = '';
  }

  const forwardedHost = firstHeaderValue(req.headers['x-forwarded-host']);
  const forwardedProto = firstHeaderValue(req.headers['x-forwarded-proto']) ?? 'https';

  if (!forwardedHost) return configuredSiteUrl;

  const isConfiguredHost = forwardedHost === configuredHost;
  const isVercelPreview = forwardedHost.endsWith('.vercel.app');
  const isLocalhost = forwardedHost.startsWith('localhost') || forwardedHost.startsWith('127.0.0.1');

  if (isConfiguredHost || isVercelPreview || isLocalhost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return configuredSiteUrl;
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

// ---------------------------------------------------------------------------
// Raw body + HMAC verification for the webhook route
// ---------------------------------------------------------------------------

export interface RawBodyResult {
  /** Every buffer worth trying as the HMAC-signed payload, in priority order. See the comment
   * in api/payments/safepay-webhook.ts for why there's more than one candidate. */
  candidates: { label: string; buffer: Buffer }[];
  /** The already-JSON-parsed body, which @vercel/node gives us regardless — used once we've
   * decided the request is authentic. */
  parsed: unknown;
}

/**
 * The raw-body gotcha: @vercel/node@5 buffers and JSON-parses the request body before the
 * handler runs. Streaming `req` yields nothing by the time we get it (`req.readableEnded` is
 * true), and the Next.js-style `export const config = { api: { bodyParser: false } }` is NOT
 * honored by bare @vercel/node functions. Meanwhile Safepay's own documented verification
 * snippet re-serializes the PARSED object (`Buffer.from(JSON.stringify(payload))`) — implying
 * they expect you to sign compact JSON that round-trips byte-for-byte through parse→stringify,
 * which isn't guaranteed in general (whitespace, number formatting, unicode escapes).
 *
 * So: collect every candidate buffer we can get our hands on, and let the caller try each one
 * against the signature. All candidates derive from the same request, so trying multiple weakens
 * nothing — it just eliminates an entire class of "which serialization did they sign" failure.
 * Once sandbox testing confirms which candidate actually matches, delete the others and keep only
 * that one (see the TODO comment left in the webhook handler for where to do this).
 */
export function readRawBody(req: VercelRequest): RawBodyResult {
  const candidates: { label: string; buffer: Buffer }[] = [];

  const anyReq = req as unknown as { rawBody?: Buffer | string };
  if (anyReq.rawBody !== undefined) {
    const buf = Buffer.isBuffer(anyReq.rawBody) ? anyReq.rawBody : Buffer.from(anyReq.rawBody);
    candidates.push({ label: 'rawBody', buffer: buf });
  }

  if (req.body !== undefined && req.body !== null) {
    try {
      candidates.push({ label: 'reserialized-body', buffer: Buffer.from(JSON.stringify(req.body)) });
    } catch {
      // req.body wasn't JSON-serializable — skip this candidate.
    }
  }

  return { candidates, parsed: req.body };
}

/** Timing-safe HMAC-SHA512 comparison, tried against every raw-body candidate. Returns the label
 * of whichever candidate matched, or null if none did (=> reject as unauthentic). */
export function verifySafepaySignature(
  raw: RawBodyResult,
  signatureHeader: string | undefined,
  secret: string
): string | null {
  if (!signatureHeader) return null;
  const signatureBuf = Buffer.from(signatureHeader, 'hex');

  for (const candidate of raw.candidates) {
    const computed = crypto.createHmac('sha512', secret).update(candidate.buffer).digest();
    if (computed.length !== signatureBuf.length) continue;
    if (crypto.timingSafeEqual(computed, signatureBuf)) {
      return candidate.label;
    }
  }
  return null;
}

export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ---------------------------------------------------------------------------
// Guarded payment-status transition — the single write path used by the webhook,
// reconcile-on-read, cancel route, and sweeper.
// ---------------------------------------------------------------------------

export interface ApplyTransitionArgs extends TransitionInput {
  orderId: string;
}

export interface ApplyTransitionResult {
  applied: boolean;
  note?: string;
  patch?: Record<string, unknown>;
}

/**
 * Runs planPaymentTransition() and, if it produced a patch, applies it as a guarded update:
 * `.update(patch).eq('id', orderId).in('payment_status', allowedFrom)`. Zero rows affected is a
 * legitimate outcome (the order was already past this event's rank) — NOT an error.
 */
export async function applyTransition(args: ApplyTransitionArgs): Promise<ApplyTransitionResult> {
  const plan = planPaymentTransition(args);
  if (!plan.patch) {
    return { applied: false, note: plan.note };
  }

  const patch: Record<string, unknown> = { ...plan.patch, payment_last_event_at: new Date().toISOString() };
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('orders')
    .update(patch)
    .eq('id', args.orderId)
    .in('payment_status', plan.allowedFrom as PaymentStatus[])
    .select('id');

  if (error) {
    throw error;
  }

  const applied = (data?.length ?? 0) > 0;

  // On a transition INTO paid, also promote fulfillment status pending -> confirmed, as a
  // separate guarded update so an admin's manual 'shipped'/'delivered' can never be reverted by
  // a late-arriving webhook.
  if (applied && patch.payment_status === 'paid') {
    await supabase.from('orders').update({ status: 'confirmed' }).eq('id', args.orderId).eq('status', 'pending');
  }

  return { applied, note: applied ? undefined : 'no rows matched allowedFrom (already past this state)', patch };
}
