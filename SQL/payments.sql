-- Payment status tracking + Safepay integration.
-- Additive, idempotent, run by hand in the Supabase SQL editor (matches the convention of the
-- other SQL/*.sql files in this repo — there is no migration tooling).
--
-- Design notes (see the implementation plan for the full rationale):
--   * payment_status is DELIBERATELY not coupled to payment_method via a CHECK constraint —
--     a card order that fails and is later collected as COD must remain a legal state.
--   * public_token is an unguessable handle for the customer-facing confirmation page, so we
--     never need an anon RLS policy on `orders` (which would leak every customer's PII).
--   * idempotency_key is what makes double-submit / back-button-resubmit safe.
--   * payment_amount_minor persists the exact integer sent to Safepay, so the webhook can
--     tripwire a denomination mismatch instead of silently accepting a 100x error.

-- ============================================================================
-- 1. New columns on orders
-- ============================================================================

alter table orders add column if not exists payment_status text;
alter table orders add column if not exists payment_provider text;
alter table orders add column if not exists safepay_tracker text;
alter table orders add column if not exists safepay_environment text;
alter table orders add column if not exists currency text not null default 'PKR';
alter table orders add column if not exists payment_amount_minor bigint;
alter table orders add column if not exists amount_paid numeric;
alter table orders add column if not exists payment_fee numeric;
alter table orders add column if not exists payment_net numeric;
alter table orders add column if not exists card_brand text;
alter table orders add column if not exists card_last4 text;
alter table orders add column if not exists charged_at timestamp with time zone;
alter table orders add column if not exists payment_failure_code text;
alter table orders add column if not exists payment_failure_message text;
alter table orders add column if not exists refunded_amount numeric not null default 0;
alter table orders add column if not exists refunded_at timestamp with time zone;
alter table orders add column if not exists payment_last_event_at timestamp with time zone;
alter table orders add column if not exists public_token text;
alter table orders add column if not exists idempotency_key text;

-- ============================================================================
-- 2. Backfill existing rows BEFORE adding NOT NULL / defaults
-- ============================================================================

update orders
set payment_status = case when payment_method = 'cash' then 'on_delivery' else 'awaiting_payment' end
where payment_status is null;

update orders
set public_token = replace(gen_random_uuid()::text, '-', '')
where public_token is null;

alter table orders alter column payment_status set default 'on_delivery';
alter table orders alter column payment_status set not null;
alter table orders alter column public_token set default replace(gen_random_uuid()::text, '-', '');
alter table orders alter column public_token set not null;

-- ============================================================================
-- 3. CHECK constraints (guarded — `add constraint` has no IF NOT EXISTS)
-- ============================================================================

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    alter table orders add constraint orders_payment_status_check check (payment_status in (
      'on_delivery',        -- COD: money collected at handover, no online payment state
      'awaiting_payment',   -- card session created, customer at Safepay checkout
      'paid',
      'failed',
      'cancelled',          -- customer abandoned or hit cancel_url, verified not-ended
      'expired',            -- swept: awaiting_payment for too long, never ended
      'partially_refunded',
      'refunded'
    ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_safepay_environment_check') then
    alter table orders add constraint orders_safepay_environment_check
      check (safepay_environment is null or safepay_environment in ('sandbox', 'production'));
  end if;
end $$;

-- ============================================================================
-- 4. Indexes
-- ============================================================================

create index if not exists idx_orders_payment_status on orders(payment_status);

create unique index if not exists uq_orders_safepay_tracker
  on orders(safepay_tracker) where safepay_tracker is not null;

create unique index if not exists uq_orders_public_token
  on orders(public_token);

create unique index if not exists uq_orders_idempotency_key
  on orders(idempotency_key) where idempotency_key is not null;

-- ============================================================================
-- 5. payment_events — the webhook idempotency mechanism (not just an audit log)
-- ============================================================================

create table if not exists payment_events (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references orders(id) on delete set null,
  provider text not null default 'safepay',
  event_type text not null,          -- 'payment.succeeded' | 'payment.failed' | ... | 'internal.*'
  event_token text,                  -- envelope `token`, if present
  body_sha256 text,                  -- sha256 of the raw signed webhook body — the real dedupe key
  tracker text,
  payload jsonb not null default '{}'::jsonb,
  signature_verified boolean not null default false,
  received_at timestamp with time zone not null default now(),
  processed_at timestamp with time zone,
  process_error text
);

-- Dedupe on body_sha256, not event_token: a Safepay retry of the same event resends identical
-- bytes (same hash); two genuinely distinct events differ in `created_at` (different hash).
-- This is correct whether or not `token` turns out to be per-event or per-delivery-attempt.
create unique index if not exists uq_payment_events_body
  on payment_events(provider, body_sha256) where body_sha256 is not null;

create index if not exists idx_payment_events_order_id on payment_events(order_id);
create index if not exists idx_payment_events_tracker on payment_events(tracker);
create index if not exists idx_payment_events_received_at on payment_events(received_at desc);

-- ============================================================================
-- 6. Atomic order + items creation (fixes the non-atomic 2-insert pattern
--    acknowledged in src/services/orders.ts's old createOrder)
-- ============================================================================

create or replace function create_order_with_items(p_order jsonb, p_items jsonb)
returns table (id uuid, public_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token text;
begin
  insert into orders (
    customer_email_or_phone, customer_first_name, customer_last_name,
    customer_address, customer_apartment, customer_city,
    payment_method, payment_status, subtotal, shipping, total,
    currency, idempotency_key
  )
  select
    p_order->>'customer_email_or_phone',
    p_order->>'customer_first_name',
    p_order->>'customer_last_name',
    p_order->>'customer_address',
    nullif(p_order->>'customer_apartment', ''),
    p_order->>'customer_city',
    p_order->>'payment_method',
    p_order->>'payment_status',
    (p_order->>'subtotal')::numeric,
    (p_order->>'shipping')::numeric,
    (p_order->>'total')::numeric,
    coalesce(p_order->>'currency', 'PKR'),
    p_order->>'idempotency_key'
  returning orders.id, orders.public_token into v_id, v_token;

  insert into order_items (order_id, product_id, size, quantity, price)
  select
    v_id,
    (e->>'product_id')::uuid,
    e->>'size',
    (e->>'quantity')::int,
    (e->>'price')::numeric
  from jsonb_array_elements(p_items) e;

  return query select v_id, v_token;
end;
$$;

-- security definer means this function runs with the privileges of its owner, bypassing RLS —
-- so it must be locked down to the service role only, or it reopens the anon write path we're
-- deliberately closing in section 7 below.
revoke all on function create_order_with_items(jsonb, jsonb) from public, anon, authenticated;
grant execute on function create_order_with_items(jsonb, jsonb) to service_role;

-- ============================================================================
-- 7. RLS
-- ============================================================================

-- Deliberate non-change: the existing "orders authenticated only" / "order_items authenticated
-- only" policies (roles {authenticated}, cmd ALL) are untouched. They continue to serve the
-- admin panel. We add NO anon policy of any kind — all order writes now go through
-- create_order_with_items() via the service role, which bypasses RLS entirely. This is what
-- fixes production checkout for real (logged-out) customers, who previously had no INSERT path.

alter table payment_events enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'payment_events' and policyname = 'payment_events authenticated read'
  ) then
    create policy "payment_events authenticated read" on payment_events
      for select to authenticated using (true);
  end if;
end $$;

-- No insert/update policy on payment_events: only the service role (RLS-bypassing) writes to it.
