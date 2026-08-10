import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { serviceClient, siteOrigin, safepayConfig } from '../../server/paymentApi.js';
import { calcTotals, toMinorUnits } from '../../src/shared/pricing.js';

/**
 * Server-authoritative order creation. Replaces the old client-side direct-insert
 * (src/services/orders.ts's former createOrder), which (a) could never actually write in
 * production once RLS tightened to authenticated-only, and (b) trusted client-supplied prices.
 * This route fixes both: it writes via the service role (bypassing RLS, but validating and
 * re-pricing everything itself), and it recomputes every price from the `products` table.
 */

const bodySchema = z.object({
  customer: z.object({
    emailOrPhone: z.string().min(1).max(200),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    address: z.string().min(1).max(300),
    apartment: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
  }),
  paymentMethod: z.enum(['cash', 'card']),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        size: z.string().min(1).max(20),
        quantity: z.number().int().min(1).max(10),
        // Informational only — the price the client's (possibly stale) cart snapshot believes
        // this line costs. NEVER used to compute totals; only compared against the server's own
        // recomputed price to detect drift (e.g. an admin changed the price after the customer
        // added it to their bag). See the comparison below.
        clientPrice: z.number().nonnegative().optional(),
      })
    )
    .min(1)
    .max(25),
  idempotencyKey: z.string().min(8).max(200),
});

interface ProductRow {
  id: string;
  name: string;
  price: number | string;
  available: boolean | null;
  sizes: string[] | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: 'BAD_REQUEST', issues: parsed.error.issues });
    return;
  }
  const { customer, paymentMethod, items, idempotencyKey } = parsed.data;

  const supabase = serviceClient();

  try {
    // ---------------------------------------------------------------------
    // 1. Idempotency: has this exact submission already been handled?
    // ---------------------------------------------------------------------
    const { data: existing, error: existingError } = await supabase
      .from('orders')
      .select('id, public_token, payment_method, payment_status, safepay_tracker, safepay_environment, total')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      const result = await respondForExistingOrder(req, supabase, existing);
      res.status(200).json(result);
      return;
    }

    // ---------------------------------------------------------------------
    // 2. Recompute prices from the products table — never trust the client's numbers.
    // ---------------------------------------------------------------------
    const productIds = [...new Set(items.map((item) => item.productId))];
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, available, sizes')
      .in('id', productIds);

    if (productsError) throw productsError;

    const productsById = new Map<string, ProductRow>((products ?? []).map((p) => [p.id, p as ProductRow]));
    const unavailable: string[] = [];

    const pricedItems = items.map((item) => {
      const product = productsById.get(item.productId);
      if (!product || product.available === false) {
        unavailable.push(item.productId);
        return null;
      }
      if (product.sizes && product.sizes.length > 0 && !product.sizes.includes(item.size)) {
        unavailable.push(item.productId);
        return null;
      }
      return {
        product_id: item.productId,
        size: item.size,
        quantity: item.quantity,
        price: Number(product.price),
        name: product.name,
        clientPrice: item.clientPrice,
      };
    });

    if (unavailable.length > 0) {
      res.status(409).json({ code: 'ITEM_UNAVAILABLE', productIds: [...new Set(unavailable)] });
      return;
    }

    const lines = pricedItems as NonNullable<(typeof pricedItems)[number]>[];
    const totals = calcTotals(lines.map((l) => ({ price: l.price, quantity: l.quantity })));

    // Detect price drift between what the customer's (possibly stale) cart believed and what
    // the DB actually says. Cash orders proceed regardless (COD price gets confirmed in person
    // anyway); card orders must never charge an amount the customer didn't see, so they're
    // rejected and the client is expected to resync via cartStore.syncPrices() and re-render.
    const priceDrift = lines.some(
      (l) => l.clientPrice !== undefined && Math.abs(l.clientPrice - l.price) > 0.01
    );
    if (priceDrift && paymentMethod === 'card') {
      res.status(409).json({
        code: 'PRICE_CHANGED',
        prices: lines.map((l) => ({ productId: l.product_id, price: l.price })),
      });
      return;
    }

    // ---------------------------------------------------------------------
    // 3. Create the order + items atomically via the RPC.
    // ---------------------------------------------------------------------
    const paymentStatus = paymentMethod === 'cash' ? 'on_delivery' : 'awaiting_payment';

    const { data: created, error: createError } = await supabase.rpc('create_order_with_items', {
      p_order: {
        customer_email_or_phone: customer.emailOrPhone,
        customer_first_name: customer.firstName,
        customer_last_name: customer.lastName,
        customer_address: customer.address,
        customer_apartment: customer.apartment ?? '',
        customer_city: customer.city,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        total: totals.total,
        currency: 'PKR',
        idempotency_key: idempotencyKey,
      },
      p_items: lines.map((l) => ({
        product_id: l.product_id,
        size: l.size,
        quantity: l.quantity,
        price: l.price,
      })),
    });

    if (createError) {
      // Postgres unique_violation on a concurrent duplicate idempotency_key — someone else's
      // request beat us to it. Re-read and return that row instead of erroring.
      if ((createError as { code?: string }).code === '23505') {
        const { data: raced, error: racedError } = await supabase
          .from('orders')
          .select('id, public_token, payment_method, payment_status, safepay_tracker, safepay_environment, total')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        if (racedError) throw racedError;
        if (raced) {
          const result = await respondForExistingOrder(req, supabase, raced);
          res.status(200).json(result);
          return;
        }
      }
      throw createError;
    }

    const row = Array.isArray(created) ? created[0] : created;
    const orderId: string = row.id;
    const publicToken: string = row.public_token;

    // ---------------------------------------------------------------------
    // 4. Cash — done.
    // ---------------------------------------------------------------------
    if (paymentMethod === 'cash') {
      res.status(200).json({
        orderId,
        publicToken,
        redirectTo: `/order/confirmation/${publicToken}`,
      });
      return;
    }

    // ---------------------------------------------------------------------
    // 5. Card — create the Safepay session.
    // ---------------------------------------------------------------------
    const session = await createSafepaySession({ req, orderId, publicToken, totalPkr: totals.total });

    if (session.ok === false) {
      // Leave the order in awaiting_payment (not failed) so the sweeper can expire it and a
      // retry with the same idempotencyKey reuses this row instead of orphaning a new one.
      await supabase.from('payment_events').insert({
        order_id: orderId,
        event_type: 'internal.session_failed',
        payload: { error: session.error },
      });
      res.status(502).json({ code: 'PAYMENT_INIT_FAILED' });
      return;
    }

    await supabase
      .from('orders')
      .update({
        payment_provider: 'safepay',
        safepay_tracker: session.tracker,
        safepay_environment: session.environment,
        payment_amount_minor: session.amountMinor,
      })
      .eq('id', orderId);

    await supabase.from('payment_events').insert({
      order_id: orderId,
      event_type: 'internal.session_created',
      tracker: session.tracker,
      payload: { amount_minor: session.amountMinor },
    });

    res.status(200).json({ orderId, publicToken, checkoutUrl: session.checkoutUrl });
  } catch (error) {
    console.error('orders/create: unexpected error', error);
    res.status(500).json({ code: 'SERVER_ERROR' });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ExistingOrderRow {
  id: string;
  public_token: string;
  payment_method: 'cash' | 'card';
  payment_status: string;
  safepay_tracker: string | null;
  safepay_environment: 'sandbox' | 'production' | null;
  total: number | string;
}

async function respondForExistingOrder(
  req: VercelRequest,
  supabase: ReturnType<typeof serviceClient>,
  order: ExistingOrderRow
) {
  if (order.payment_method === 'cash' || order.payment_status === 'paid') {
    return { orderId: order.id, publicToken: order.public_token, redirectTo: `/order/confirmation/${order.public_token}` };
  }

  // Card order still awaiting payment WITH a tracker — re-mint a fresh client token and rebuild
  // the checkout URL from that stored tracker. Never cache/replay a checkout URL: the `tbt`
  // token expires after 1 hour, so a stale cached URL would 401 on the customer.
  if (order.safepay_tracker && order.safepay_environment) {
    const config = safepayConfig();
    const tbt = await mintClientToken(config);
    if (tbt) {
      const origin = siteOrigin(req);
      const checkoutUrl = buildCheckoutUrl({
        config,
        tracker: order.safepay_tracker,
        tbt,
        redirectUrl: `${origin}/order/confirmation/${order.public_token}`,
        cancelUrl: `${origin}/order/cancelled/${order.public_token}`,
      });
      return { orderId: order.id, publicToken: order.public_token, checkoutUrl };
    }
    // tbt minting failed — fall through to a full session retry below rather than dead-ending.
  }

  // Card order awaiting payment with NO tracker: the first attempt's Safepay session creation
  // never succeeded (e.g. Safepay was unreachable, or — as happened once in testing — the
  // required env vars weren't set yet). Retry it fresh on this same order rather than silently
  // redirecting to a confirmation page that can never resolve (reconcile-on-read has nothing to
  // reconcile against without a tracker). This is what makes a retry after a transient Safepay
  // outage actually work instead of permanently stranding the order.
  const session = await createSafepaySession({ req, orderId: order.id, publicToken: order.public_token, totalPkr: Number(order.total) });

  if (session.ok === false) {
    await supabase.from('payment_events').insert({
      order_id: order.id,
      event_type: 'internal.session_failed',
      payload: { error: session.error },
    });
    // Still send them to the status page rather than an error — reconcile-on-read there is
    // harmless (no tracker means it just reports awaiting_payment), and this keeps the response
    // shape uniform. The customer sees "confirming" briefly, then the pollsExhausted fallback
    // copy ("still confirming... contact us") — better than a raw 502 on a checkout retry.
    return { orderId: order.id, publicToken: order.public_token, redirectTo: `/order/confirmation/${order.public_token}` };
  }

  await supabase
    .from('orders')
    .update({
      payment_provider: 'safepay',
      safepay_tracker: session.tracker,
      safepay_environment: session.environment,
      payment_amount_minor: session.amountMinor,
    })
    .eq('id', order.id);

  await supabase.from('payment_events').insert({
    order_id: order.id,
    event_type: 'internal.session_created',
    tracker: session.tracker,
    payload: { amount_minor: session.amountMinor, retried: true },
  });

  return { orderId: order.id, publicToken: order.public_token, checkoutUrl: session.checkoutUrl };
}

interface SafepaySessionResult {
  ok: true;
  tracker: string;
  environment: 'sandbox' | 'production';
  amountMinor: number;
  checkoutUrl: string;
}
interface SafepaySessionError {
  ok: false;
  error: string;
}

async function createSafepaySession(args: {
  req: VercelRequest;
  orderId: string;
  publicToken: string;
  totalPkr: number;
}): Promise<SafepaySessionResult | SafepaySessionError> {
  const config = safepayConfig();
  const amountMinor = toMinorUnits(args.totalPkr);

  try {
    const sessionRes = await fetch(`${config.apiHost}/order/payments/v3/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.secretKey}`,
        'X-SFPY-MERCHANT-SECRET': config.secretKey,
      },
      body: JSON.stringify({
        merchant_api_key: config.merchantApiKey,
        intent: 'CYBERSOURCE',
        mode: 'payment',
        currency: 'PKR',
        amount: amountMinor,
        metadata: { order_id: args.orderId, public_token: args.publicToken, source: 'amore-web' },
      }),
    });

    if (!sessionRes.ok) {
      const text = await sessionRes.text().catch(() => '');
      return { ok: false, error: `session create ${sessionRes.status}: ${text.slice(0, 500)}` };
    }
    const sessionBody = (await sessionRes.json()) as {
      data?: { tracker?: { token?: string; state?: string } };
    };
    const tracker = sessionBody.data?.tracker?.token;
    const state = sessionBody.data?.tracker?.state;
    if (!tracker || !tracker.startsWith('track_') || state !== 'TRACKER_STARTED') {
      return { ok: false, error: `unexpected session response: ${JSON.stringify(sessionBody).slice(0, 500)}` };
    }

    const tbt = await mintClientToken(config);
    if (!tbt) {
      return { ok: false, error: 'client token mint failed' };
    }

    const origin = siteOrigin(args.req);
    const checkoutUrl = buildCheckoutUrl({
      config,
      tracker,
      tbt,
      redirectUrl: `${origin}/order/confirmation/${args.publicToken}`,
      cancelUrl: `${origin}/order/cancelled/${args.publicToken}`,
    });

    return { ok: true, tracker, environment: config.environment, amountMinor, checkoutUrl };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function mintClientToken(config: ReturnType<typeof safepayConfig>): Promise<string | null> {
  try {
    const res = await fetch(`${config.apiHost}/client/passport/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.secretKey}`,
        'X-SFPY-MERCHANT-SECRET': config.secretKey,
      },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: string };
    return body.data ?? null;
  } catch {
    return null;
  }
}

function buildCheckoutUrl(args: {
  config: ReturnType<typeof safepayConfig>;
  tracker: string;
  tbt: string;
  redirectUrl: string;
  cancelUrl: string;
}): string {
  const url = new URL(args.config.checkoutHost);
  url.searchParams.set('tracker', args.tracker);
  url.searchParams.set('tbt', args.tbt);
  url.searchParams.set('environment', args.config.environment);
  url.searchParams.set('source', 'hosted');
  // redirect_url/cancel_url carry the public_token in the PATH (not as a query param) — Safepay
  // appends `?tracker=...` on return, and path placement sidesteps any question of whether it
  // correctly switches to `&` for a redirect_url that already had a query string.
  url.searchParams.set('redirect_url', args.redirectUrl);
  url.searchParams.set('cancel_url', args.cancelUrl);
  return url.toString();
}
