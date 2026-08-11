# Payments (Safepay) — architecture, gotchas, and how to work on this

This doc exists so a future session (human or AI) can pick up payment-related work without
re-deriving everything that was learned the hard way while shipping this. Read this before
touching anything under `api/orders/`, `api/payments/`, `server/`, or `src/shared/*`.

## Why Safepay

Stripe does not onboard Pakistan-registered businesses. [Safepay](https://getsafepay.com) is an
SBP-ecosystem payment gateway whose hosted checkout accepts both local and international
Visa/Mastercard, charged in PKR (the customer's own bank handles FX for international cards —
there is no multi-currency logic in this codebase, deliberately).

## The two payment methods

- **`cash`** (Cash on Delivery) — `payment_status` goes straight to `on_delivery`, no Safepay
  involvement at all.
- **`card`** — routed through Safepay's hosted checkout. `payment_status` starts at
  `awaiting_payment`, and only a webhook (or a reconcile check) can move it to `paid`.

These are two *separate* status axes on the `orders` table: `status` (fulfillment: pending →
confirmed → shipped → delivered/cancelled) and `payment_status` (money: on_delivery |
awaiting_payment | paid | failed | cancelled | expired | partially_refunded | refunded). A card
order can be `paid` while still `pending` fulfillment, or `delivered` while `refunded`. Never
conflate the two.

## Request flow, end to end (card)

```
Checkout.tsx
  → POST /api/orders/create   (no prices in the request — server recomputes from `products`)
      → creates order row (payment_status: awaiting_payment) via create_order_with_items() RPC
      → POST {SAFEPAY_API_HOST}/order/payments/v3/        (create payment session/tracker)
      → POST {SAFEPAY_API_HOST}/client/passport/v1/token  (mint short-lived `tbt` auth token)
      → builds checkoutUrl at {SAFEPAY_CHECKOUT_HOST}?tracker=...&tbt=...&environment=...&source=hosted&redirect_url=...&cancel_url=...
  ← { checkoutUrl }
Checkout.tsx does window.location.assign(checkoutUrl)  — a real top-level redirect, NOT a widget/iframe

  ... customer pays on Safepay's hosted page ...

Safepay redirects back to redirect_url (or cancel_url), appending ?tracker=track_...
  → OrderStatus.tsx (src/pages/OrderStatus.tsx) polls GET /api/orders/status?token=...
      → "reconcile-on-read": if still awaiting_payment, calls Safepay's reporter endpoint directly
        and flips to paid if TRACKER_ENDED — this is what makes the confirmation page correct
        even if the webhook is slow, lost, or races the redirect

Independently, Safepay POSTs to /api/payments/safepay-webhook with payment.succeeded /
payment.failed / payment.refunded events — this is the authoritative, async path. Idempotent,
signature-verified, applies the same guarded state machine as reconcile-on-read
(src/shared/paymentTransitions.ts), so whichever arrives first wins and the other is a safe no-op.
```

A cron sweeper (`api/payments/sweep.ts`, daily at 03:00 — see **Vercel Hobby plan** below) catches
anything that falls through both of those paths: an order stuck in `awaiting_payment` for over an
hour gets reconciled against Safepay directly, or expired if it never completed.

## File map

| File | Responsibility |
|---|---|
| `SQL/payments.sql` | The migration: new `orders` columns, `payment_events` table, `create_order_with_items()` RPC. Run by hand in the Supabase SQL editor (no migration tooling in this repo — see `SQL/orders.sql` for the pre-existing convention). |
| `src/shared/pricing.ts` | Shipping/subtotal math + `toMinorUnits()` (PKR → paisa, ×100 — **the single choke point if the denomination is ever wrong**, see below). Shared by client and server. |
| `src/shared/orderStatus.ts` | The `FULFILLMENT_STATUSES` / `PAYMENT_STATUSES` enums + labels. Single source of truth — do not re-declare these anywhere else. |
| `src/shared/paymentTransitions.ts` | `planPaymentTransition()` — the monotonic state machine. Every payment-status write in the whole system goes through this. See **The state machine**, below. |
| `src/shared/refunds.ts` | `isRefundable()` / `getRefundTarget()` — the refund policy, in exactly two functions. See **Refunds**, below. |
| `src/shared/safepay.ts` | Provider constants: API hosts, checkout hosts, tracker states, webhook event types. No secrets. |
| `server/paymentApi.ts` | Server-only helpers: `serviceClient()`, `safepayConfig()`, `siteOrigin()`, `readRawBody()` / `verifySafepaySignature()`, `applyTransition()`. **Must live outside `api/`** — see **The ERR_MODULE_NOT_FOUND saga**, below. |
| `api/orders/create.ts` | POST. Server-authoritative order creation: recomputes prices from `products`, idempotent, creates the Safepay session for card orders. |
| `api/orders/status.ts` | GET `?token=`. Customer-facing status with a whitelisted projection + reconcile-on-read. |
| `api/orders/cancel.ts` | POST. Verifies with Safepay before trusting a browser-reported cancellation. |
| `api/orders/reconcile.ts` | POST, admin-authenticated. Manual "sync payment status" button. |
| `api/payments/safepay-webhook.ts` | POST. HMAC-verified, idempotent (dedup on `sha256(rawBody)`), applies `planPaymentTransition()`. |
| `api/payments/sweep.ts` | GET, cron-guarded. Catches stuck `awaiting_payment` orders. |
| `src/pages/Checkout.tsx` | Customer checkout form. Sends no prices; only `productId`/`size`/`quantity` + an informational `clientPrice` for drift detection. |
| `src/pages/OrderStatus.tsx` | Confirmation (`/order/confirmation/:token`) and cancelled (`/order/cancelled/:token`) pages — same component, `mode` prop. |
| `src/pages/admin/AdminOrders.tsx` | Payment status column/filter, full payment detail in the modal, refund deep-link, sync button, `payment_events` timeline. |

## The state machine (`src/shared/paymentTransitions.ts`)

`planPaymentTransition({current, eventType, data})` returns `{patch, allowedFrom}`. The caller
(`applyTransition()` in `server/paymentApi.ts`) applies `patch` as a **guarded update**:

```ts
.update(patch).eq('id', orderId).in('payment_status', allowedFrom)
```

This is optimistic concurrency without a real transaction. If a webhook and a reconcile-on-read
race each other, whichever writes first wins — the loser's write matches zero rows (a *legitimate*
no-op, not an error) because by then `payment_status` is no longer in `allowedFrom`.

Rank order (a transition can only move forward): `on_delivery`/`awaiting_payment` (0) →
`cancelled`/`expired`/`failed` (1) → `paid` (2) → `partially_refunded` (3) → `refunded` (4).

Key invariants encoded in `allowedFrom` per event — **do not loosen these without understanding
why they're narrow**:
- `payment.succeeded`: `allowedFrom: ['awaiting_payment','failed','cancelled','expired']` — a late
  success can rescue a prematurely-expired order.
- `payment.failed`: `allowedFrom: ['awaiting_payment']` **only** — this is what stops a late,
  out-of-order failure webhook from downgrading an order a `payment.succeeded` already marked paid.
- `payment.refunded`: only from `paid`/`partially_refunded`/`refunded`. Prefers `data.balance`
  (absolute remaining amount) over accumulating `data.refund_amount` when both are present — see
  the code comment for why (unverified whether `refund_amount` is incremental per-event).

## Idempotency (double-submit / retry safety)

Every `create` request carries a client-generated `idempotencyKey` (persisted across a page
reload via `localStorage['amore-pending-order']` in `Checkout.tsx`). `api/orders/create.ts` looks
this up first; if a row exists:
- cash, or already `paid` → return its confirmation link.
- card, `awaiting_payment`, **has a tracker** → re-mint a fresh `tbt` (never cache/replay a
  checkout URL — `tbt` expires after 1 hour) and rebuild the checkout URL from the stored tracker.
- card, `awaiting_payment`, **no tracker** → retry Safepay session creation on that same order
  (see **Stuck-forever orders**, below — this branch didn't always exist).

`payment_events` dedupes webhook deliveries on `sha256(raw body)`, not the envelope's `token`
field (a retry of the same event resends identical bytes → identical hash; two genuinely distinct
events differ in `created_at` → different hash — correct regardless of whether `token` turns out
to be per-event or per-delivery-attempt, which was never confirmed).

## Refunds

Safepay's only documented refund mechanism is their **merchant dashboard** (Payments → select
transaction → Refund) — there is no public REST refund endpoint. So:
- Admin panel shows a **deep link** to the transaction in Safepay's dashboard (`isRefundable()` +
  `getRefundTarget()` in `src/shared/refunds.ts` — the *only* two places refund policy lives).
- The merchant refunds there; our DB syncs back automatically via the `payment.refunded` webhook.
- If Safepay ever exposes a real refund API, change `getRefundTarget()` to return `{mode:'api'}`
  and add `api/payments/refund.ts` — the admin button's branch already handles that case, no other
  file needs to change.
- 60-day refund window, captured transactions only — enforced client-side only in `isRefundable()`
  (cosmetic if wrong; Safepay's dashboard is the real enforcement).

## Environment variables

Server-only, **must never carry a `VITE_` prefix** (that would bundle them into the browser):

| Var | Notes |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Full RLS bypass. The one truly dangerous secret. |
| `SAFEPAY_ENVIRONMENT` | `sandbox` \| `production` |
| `SAFEPAY_API_HOST` | Defaults from `SAFEPAY_HOSTS` in `src/shared/safepay.ts` if unset. |
| `SAFEPAY_CHECKOUT_HOST` | Defaults from `SAFEPAY_CHECKOUT_HOSTS` if unset — **see below, this one bit us badly**. |
| `SAFEPAY_MERCHANT_API_KEY` / `SAFEPAY_SECRET_KEY` | No fallback — `safepayConfig()` throws if missing. |
| `SAFEPAY_WEBHOOK_SECRET` | Per-endpoint. Sandbox and production each have their own — get it from Safepay Dashboard → Developers → Endpoints → the endpoint → "View shared secret", *after* registering the endpoint URL there. |
| `SITE_URL` | Used to build `redirect_url`/`cancel_url`. `siteOrigin()` in `server/paymentApi.ts` also allowlists `*.vercel.app` so preview deploys redirect back to themselves rather than production. |
| `CRON_SECRET` | Guards `api/payments/sweep.ts`. Vercel auto-sends this as `Authorization: Bearer <CRON_SECRET>` on cron-triggered invocations. |

**⚠️ Env vars set directly in the Vercel dashboard always override the code's defaults.** If you
change a default in `src/shared/safepay.ts` (or anywhere in `server/paymentApi.ts`'s
`safepayConfig()`), and the same variable is *also* set in Vercel's Environment Variables UI, your
code change has **zero effect in production** until someone updates or removes the dashboard
value too. This cost real debugging time — see the checkout-URL story below.

---

## War stories — things that actually broke in production, and why

These are worth reading in full before touching this code again; each one cost a real deploy
cycle to diagnose.

### 1. `ERR_MODULE_NOT_FOUND` — missing `.js` extensions

This repo's `package.json` has `"type": "module"`. Vercel deploys `api/*.ts` as **real Node ESM,
transpiled per-file**, not bundled into one file per function the way you might expect from
`@vercel/node`. Node's own strict ESM resolver runs at *request time* and — unlike TypeScript's
`"bundler"` moduleResolution, which `tsc --noEmit` happily accepts — does **not** auto-append
extensions to relative import specifiers.

```ts
// Typechecks fine. 500s 100% of the time in production with
// Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/paymentApi'
import { serviceClient } from '../../server/paymentApi';

// Correct — .js refers to the file's COMPILED output, even though the source is .ts:
import { serviceClient } from '../../server/paymentApi.js';
```

**Every relative import in every `api/*.ts` file, and every file they import (`server/`,
`src/shared/*`), must end in an explicit `.js`.** This is invisible locally — `npm run build` is
just `vite build` (esbuild, tolerant), and nothing runs the API routes locally by default (see
**How to actually test this locally**, below) — so the only way to catch a missing extension
before it 500s in production is Vercel's own build-time typecheck (see the next section) or
manual discipline.

A red herring on the way to finding this: the first fix attempt was moving `api/_lib/server.ts` →
`server/paymentApi.ts`, on the theory that Vercel excludes leading-underscore directories under
`api/` from the deployed bundle. That was **wrong** — the exact same error followed the file to
its new location. The underscore had nothing to do with it; only the missing `.js` did.

### 2. Vercel's build-time typecheck is a second, different TypeScript pass

Vercel runs its own `tsc`-based check per API function during build (`Using TypeScript 5.8.3
(local user-provided)` in the build log) — **separate from** the project's own tsconfigs, and
**non-blocking** (a typecheck error there does not fail the deployment; only an actual esbuild
transpile error would). Two things fell out of this:
- It's what caught the missing-`.js`-extension bug above (`error TS2835: Relative import paths
  need explicit file extensions... Did you mean './orderStatus.js'?`) — useful signal, worth
  reading even though it's non-blocking.
- It does **not** resolve the `@/` path alias the way `tsconfig.app.json`/`tsconfig.api.json` do
  locally, even though the root `tsconfig.json` defines the same `paths` mapping. This is why
  `src/lib/seo.ts` showed `Cannot find module '@/services/products'` in the build log for a long
  time — harmless (both were `import type`, fully erased at compile time, never a real bug), but
  noisy. Fixed by switching those two imports to plain relative paths (`../services/products.js`)
  instead of `@/services/products` — **`@/` is not reliable inside anything that gets pulled into
  an `api/*.ts` type-check chain, even transitively.** Prefer relative imports (with `.js`) for
  any file that might be imported, even just for its types, from `api/` or `server/`.

**`tsconfig.api.json` exists specifically so `api/` and `server/` get typechecked locally at all**
(`npx tsc -p tsconfig.api.json --noEmit`) — before this repo had it, `api/` was checked by
*nothing*, and the extensionless-import bug could have shipped silently forever. Run this (and
`tsconfig.app.json`) before every push that touches payment code.

### 3. Vercel Hobby plan cron limitation

`vercel.json`'s cron for `api/payments/sweep.ts` was originally `*/15 * * * *`. Hobby-tier Vercel
accounts only permit **daily** cron schedules — anything more frequent fails validation and
**silently blocks every deployment** (not just the cron; the whole `vercel.json` is rejected). If
deployments stop landing for no apparent reason, check whether a cron schedule was tightened.
Current schedule: `0 3 * * *` (once daily). This makes the sweeper a same-day safety net rather
than near-real-time — acceptable because reconcile-on-read (`api/orders/status.ts`) is the fast
path for a missed webhook; the sweeper only matters for an order nobody ever revisits.

### 4. GitHub↔Vercel webhook silently stopped firing

At one point, pushes to `main` stopped triggering deployments entirely — no error, no failed
deployment record, just nothing. `vercel list_deployments` showed the last deployment was hours
old despite several intervening pushes. Nothing in this codebase's tools can fix a broken
GitHub-App webhook registration; the fix is a dashboard action: **Project Settings → Git →
Disconnect, then Connect Git Repository again** — this re-registers the webhook with GitHub.
Always sanity-check with `list_deployments` (or the Vercel dashboard) that a push actually
triggered a build before assuming a deploy landed.

### 5. Safepay's `metadata` object validates keys server-side

The initial session-creation payload sent `metadata: { order_id, public_token, source }`. Safepay
rejected the request outright: `"unsupported meta key public_token"` — every card checkout 502'd
with `PAYMENT_INIT_FAILED`, and **the real reason was only visible in `payment_events.payload`**,
never surfaced to the client or general Vercel logs (the client just sees a generic 502). Safepay
validates `metadata`'s keys against an undocumented server-side allowlist. Only `order_id` is
sent now — it's also the only key `api/payments/safepay-webhook.ts` actually reads (as its
tracker-lookup fallback via `data.metadata.order_id`). **If you ever need to add a metadata key,
expect it might be silently rejected — check `payment_events` for `internal.session_failed`
entries after testing, not just the client-facing error.**

### 6. The hosted-checkout base URL is not in Safepay's public docs

Safepay's Express Checkout guide says "use our SDK to generate the checkout URL" and never shows
the actual URL format. The plausible-looking guess that shipped first —
`https://sandbox.api.getsafepay.com/checkout/pay` — was wrong, and produced a checkout page that
rendered but errored: **"Required environment is missing. Please close this window and try
again."** (Note this error page loads fine, HTTP 200 — it is not a network/404 failure, which
made it look like a client-side integration problem rather than a wrong base URL.)

The actual correct values (ground truth: `node_modules/@sfpy/node-core/esm/Checkout.js`,
installed temporarily just to read its source, then removed — see
`src/shared/safepay.ts`'s `SAFEPAY_CHECKOUT_HOSTS`):

```
sandbox:    https://sandbox.api.getsafepay.com/embedded/
production: https://getsafepay.com/embedded/
```

**Production's checkout domain is `getsafepay.com`, not `api.getsafepay.com`** — a completely
different domain from the production API host, not just a subdomain swap. This would have been a
second silent bug on go-live if `SAFEPAY_CHECKOUT_HOSTS.production` had been naively derived from
`SAFEPAY_HOSTS.production` instead of hardcoded separately. If Safepay's checkout base URL ever
needs re-verifying again, `npm install @sfpy/node-core`, read
`node_modules/@sfpy/node-core/types/Checkout.d.ts` and `esm/Checkout.js`, then `npm uninstall` it
— that package is not a runtime dependency of this codebase, it was only ever used as a docs
source.

**Compounding factor:** `SAFEPAY_CHECKOUT_HOST` was *also* set as an explicit override in the
Vercel dashboard (to the same wrong value), so fixing the code default alone did **not** fix
production — the dashboard value took precedence. Two separate deploys were needed: one for the
code fix, one after manually updating the Vercel env var. **Whenever a Safepay host/URL constant
changes in code, check whether the same variable has a dashboard override that also needs
updating** (`SAFEPAY_API_HOST`, `SAFEPAY_CHECKOUT_HOST`, `SAFEPAY_ENVIRONMENT` are all real risks
here).

### 7. Stuck-forever orders (trackerless idempotency retries)

If Safepay session creation fails for *any* reason (missing env vars, an outage, the metadata
rejection above) on a card order's first attempt, the order row is already written as
`awaiting_payment` with `safepay_tracker: null` (order creation and session creation are
deliberately separate steps — the order must exist before we can reference it in `metadata`). The
customer sees a generic error and, naturally, retries.

The **first** version of the idempotency-retry logic (`respondForExistingOrder()` in
`api/orders/create.ts`) checked for an existing tracker, found none, and just... redirected to the
confirmation page anyway, on the theory that reconcile-on-read would sort it out. **It can't** —
reconcile-on-read needs a tracker to check against Safepay's reporter endpoint; with no tracker,
there is nothing to reconcile. The customer landed on "Confirming your payment..." and stayed
there forever, with an order that could never self-heal no matter how many times they retried
(same `idempotencyKey` → same broken row → same dead end).

Fixed: the no-tracker branch now **retries Safepay session creation** on that same order (not a
new one — the `idempotency_key` uniqueness is preserved) rather than giving up. The cron sweeper
had the identical bug for the same reason (`.not('safepay_tracker', 'is', null)` filtered these
rows out of its own query, so it would never have expired them either) — also fixed, trackerless
`awaiting_payment` rows now go straight to `expired` in the sweep.

**If you ever see an order permanently stuck in `awaiting_payment` with `safepay_tracker: null`**,
check `payment_events` for that `order_id` — there will be an `internal.session_failed` row with
the real Safepay error in `payload.error` (this is how bugs #5 and #6 above were actually
diagnosed, not from the generic client-facing 502).

---

## How to actually test this locally / in sandbox

- `npm run dev` (plain `vite dev`) **cannot** exercise `/api/*` — Vercel functions don't run under
  it. Use `vercel dev`, or push to a branch and test against the resulting Vercel preview
  deployment (preview URLs are `*.vercel.app`, which `siteOrigin()` allowlists for the
  redirect/cancel URLs).
- Safepay **webhooks require a public HTTPS endpoint** — you cannot receive them on localhost at
  all. Preview or production deployments only.
- Fastest way to debug a failed checkout in production without waiting on Vercel's log
  retention/query limits (Hobby plan appears to reject historical log queries beyond a fairly
  short window with `ExceedsBillingLimitError`): **query `payment_events` directly** for the
  order in question. The real Safepay error is almost always there, not in the generic
  client-facing error message.
- A synthetic end-to-end test, from a real product row, without touching the UI:
  ```bash
  curl -s -X POST https://rarstudio.co/api/orders/create \
    -H "Content-Type: application/json" \
    -d '{
      "customer": {"emailOrPhone":"test@example.com","firstName":"Test","lastName":"User","address":"123 Test St","city":"Lahore"},
      "paymentMethod":"card",
      "items":[{"productId":"<real-product-uuid>","size":"M","quantity":1}],
      "idempotencyKey":"test-'"$(date +%s)"'"
    }'
  ```
  This returns a real `checkoutUrl` you can open in a browser to visually confirm the amount and
  that the checkout page actually renders (catches both bugs #5 and #6 above without needing a
  full browser checkout run).
- [Safepay's test card numbers](https://safepay.helpscoutdocs.com/article/41-dummy-card-information)
  for exercising success/decline/3DS flows without a real card.

## Known unverified risks (still open)

- Whether `payment.refunded`'s `refund_amount` field is incremental or cumulative across multiple
  partial refunds on the same order — `planPaymentTransition()` prefers `data.balance` (absolute)
  when present specifically to sidestep this; verify with two sequential partial refunds in
  sandbox if this ever matters.
- Whether the webhook envelope's `token` field is unique per event or per delivery attempt —
  sidestepped entirely by deduping on `sha256(raw body)` instead.
- Whether `payment.succeeded` reliably carries `payment_method.card_type`/`last_four` — backfilled
  from the reporter endpoint during reconcile-on-read regardless, so this doesn't block anything,
  but hasn't been directly confirmed.
- No inventory/stock tracking exists anywhere in this codebase (`products.available` is a bare
  boolean, no quantities). Overselling a card-paid order means holding a customer's money for
  something that can't ship — accepted risk, flagged as the natural next piece of work.
- `ProtectedRoute.tsx` has no role check — "admin" means any authenticated Supabase user.
  `api/orders/reconcile.ts` inherits exactly that weak bar deliberately (matches the rest of the
  admin panel); don't build anything on top of it assuming a stronger guarantee.
