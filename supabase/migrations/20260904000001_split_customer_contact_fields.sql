-- Split the checkout's single "email or phone" field into separate customer_email (optional)
-- and customer_phone (required, E.164) columns, and update the contact email shown on the site.
--
-- customer_email_or_phone is left in place (NOT NULL, unchanged) for backward-compatible
-- search/history on rows created before this change. Going forward the app writes customer_phone
-- into it too (never blank, since phone is required) so nothing that still reads it breaks;
-- customer_email and customer_phone are the fields the app actually reads/writes from here on.

alter table public.orders
  add column if not exists customer_email text,
  add column if not exists customer_phone text;

-- Best-effort backfill for existing rows from the old combined field: an "@" means it was an
-- email, otherwise treat it as a phone number (as entered — not necessarily E.164, since the old
-- field had no validation).
update public.orders
set
  customer_email = case when customer_email_or_phone like '%@%' then customer_email_or_phone else null end,
  customer_phone = case when customer_email_or_phone like '%@%' then '' else customer_email_or_phone end
where customer_phone is null;

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
    customer_email_or_phone, customer_email, customer_phone,
    customer_first_name, customer_last_name,
    customer_address, customer_apartment, customer_city,
    payment_method, payment_status, subtotal, shipping, total,
    currency, idempotency_key
  )
  select
    coalesce(nullif(p_order->>'customer_phone', ''), p_order->>'customer_email', ''),
    nullif(p_order->>'customer_email', ''),
    p_order->>'customer_phone',
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

-- Public-facing contact email (Footer, Contact page, and the Admin > Site Content editor) — the
-- client asked for this swapped from rarstudio2026@gmail.com to portfoliowaqar@gmail.com.
update public.site_content
set content = jsonb_set(content, '{info,email}', '"portfoliowaqar@gmail.com"', false),
    updated_at = now()
where page = 'contact'
  and content->'info'->>'email' = 'rarstudio2026@gmail.com';
