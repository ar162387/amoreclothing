-- ============================================================================
-- RAR Studio — schema migration from the old (restricted) Supabase project
-- phozfqoxffiskjmynrjz  ->  agznnxsvfqbylpvostol
--
-- Run this FIRST in the new project's SQL Editor, then run
-- 20260903000002_seed_from_phozfqox.sql for the data.
--
-- Storage is NOT migrated — media now lives in Cloudinary. The old `products`
-- bucket and its policies are intentionally omitted.
-- ============================================================================

-- Extensions (already present on a fresh Supabase project, but harmless to assert)
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists public.collections (
  id          uuid primary key default extensions.uuid_generate_v4(),
  name        text not null,
  season      text not null,
  description text,
  created_at  timestamptz default now()
);

create table if not exists public.fabric_care (
  id         uuid primary key default extensions.uuid_generate_v4(),
  title      text not null,
  body       text not null default '',
  created_at timestamptz default now()
);

create table if not exists public.products (
  id             uuid primary key default extensions.uuid_generate_v4(),
  name           text not null,
  price          numeric not null,
  description    text,
  collection_id  uuid references public.collections(id),
  image_front    text,
  image_back     text,
  images_other   text[],
  sizes          text[],
  available      boolean default true,
  featured       boolean default false,
  created_at     timestamptz default now(),
  size_guide     jsonb not null default '[]'::jsonb,
  fabric_care_id uuid references public.fabric_care(id)
);

create table if not exists public.orders (
  id                      uuid primary key default extensions.uuid_generate_v4(),
  customer_email_or_phone text not null,
  customer_first_name     text not null,
  customer_last_name      text not null,
  customer_address        text not null,
  customer_apartment      text,
  customer_city           text not null,
  payment_method          text not null check (payment_method = any (array['cash','card'])),
  status                  text not null default 'pending'
                            check (status = any (array['pending','confirmed','shipped','delivered','cancelled'])),
  subtotal                numeric not null,
  shipping                numeric not null default 0,
  total                   numeric not null,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  payment_status          text not null default 'on_delivery'
                            check (payment_status = any (array['on_delivery','awaiting_payment','paid','failed','cancelled','expired','partially_refunded','refunded'])),
  payment_provider        text,
  safepay_tracker         text,
  safepay_environment     text check (safepay_environment is null or (safepay_environment = any (array['sandbox','production']))),
  currency                text not null default 'PKR',
  payment_amount_minor    bigint,
  amount_paid             numeric,
  payment_fee             numeric,
  payment_net             numeric,
  card_brand              text,
  card_last4              text,
  charged_at              timestamptz,
  payment_failure_code    text,
  payment_failure_message text,
  refunded_amount         numeric not null default 0,
  refunded_at             timestamptz,
  payment_last_event_at   timestamptz,
  public_token            text not null default replace(gen_random_uuid()::text, '-', ''),
  idempotency_key         text
);

create table if not exists public.order_items (
  id         uuid primary key default extensions.uuid_generate_v4(),
  order_id   uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  size       text not null,
  quantity   integer not null check (quantity > 0),
  price      numeric not null,
  created_at timestamptz default now()
);

create table if not exists public.payment_events (
  id                 uuid primary key default extensions.uuid_generate_v4(),
  order_id           uuid references public.orders(id),
  provider           text not null default 'safepay',
  event_type         text not null,
  event_token        text,
  body_sha256        text,
  tracker            text,
  payload            jsonb not null default '{}'::jsonb,
  signature_verified boolean not null default false,
  received_at        timestamptz not null default now(),
  processed_at       timestamptz,
  process_error      text
);

create table if not exists public.site_content (
  page       text primary key check (page = any (array['home','contact','shipping'])),
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_order_items_order_id       on public.order_items (order_id);
create index if not exists idx_orders_created_at          on public.orders (created_at desc);
create index if not exists idx_orders_status             on public.orders (status);
create index if not exists idx_orders_payment_status     on public.orders (payment_status);
create unique index if not exists uq_orders_safepay_tracker on public.orders (safepay_tracker) where (safepay_tracker is not null);
create unique index if not exists uq_orders_public_token   on public.orders (public_token);
create unique index if not exists uq_orders_idempotency_key on public.orders (idempotency_key) where (idempotency_key is not null);
create index if not exists idx_payment_events_order_id    on public.payment_events (order_id);
create index if not exists idx_payment_events_tracker     on public.payment_events (tracker);
create index if not exists idx_payment_events_received_at on public.payment_events (received_at desc);
create unique index if not exists uq_payment_events_body   on public.payment_events (provider, body_sha256) where (body_sha256 is not null);

-- ----------------------------------------------------------------------------
-- Functions + triggers
-- ----------------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.create_order_with_items(p_order jsonb, p_items jsonb)
returns table(id uuid, public_token text)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
$function$;

drop trigger if exists update_orders_updated_at on public.orders;
create trigger update_orders_updated_at
  before update on public.orders
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_site_content_updated_at on public.site_content;
create trigger update_site_content_updated_at
  before update on public.site_content
  for each row execute function public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Grants (mirrors the old project's grant_table_privileges migration)
-- ----------------------------------------------------------------------------
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.collections    enable row level security;
alter table public.fabric_care    enable row level security;
alter table public.products       enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.payment_events enable row level security;
alter table public.site_content   enable row level security;

-- public read, authenticated write
create policy "collections public read"        on public.collections for select to public using (true);
create policy "collections authenticated write" on public.collections for all to authenticated using (true) with check (true);

create policy "fabric_care public read"        on public.fabric_care for select to public using (true);
create policy "fabric_care authenticated write" on public.fabric_care for all to authenticated using (true) with check (true);

create policy "products public read"        on public.products for select to public using (true);
create policy "products authenticated write" on public.products for all to authenticated using (true) with check (true);

create policy "site_content public read"        on public.site_content for select to public using (true);
create policy "site_content authenticated write" on public.site_content for all to authenticated using (true) with check (true);

-- orders / order_items / payment_events: authenticated only (checkout writes go through
-- the service-role key in api/, which bypasses RLS)
create policy "orders authenticated only"      on public.orders for all to authenticated using (true) with check (true);
create policy "order_items authenticated only" on public.order_items for all to authenticated using (true) with check (true);
create policy "payment_events authenticated read" on public.payment_events for select to authenticated using (true);
