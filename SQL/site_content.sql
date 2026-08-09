-- Site content: one row per public page, content stored as a JSONB document.
-- Shape is defined in src/services/siteContent.ts and defaulted in
-- src/config/siteContent.defaults.ts. Missing/stale keys always fall back to
-- the bundled defaults (see src/lib/siteContent.ts mergeContent), so a blank
-- or partial row here can never blank out the live site.
--
-- Only 'home' and 'contact' are content-managed. Collections, About and
-- Size Guide stay hardcoded and are not represented here.

create table if not exists site_content (
  page       text primary key check (page in ('home', 'contact')),
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default now()
);

-- Reuses the same trigger function defined in SQL/orders.sql. Re-declared
-- here (create or replace) so this script is standalone.
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_site_content_updated_at on site_content;
create trigger update_site_content_updated_at
  before update on site_content
  for each row
  execute function update_updated_at_column();

-- RLS: an event trigger (rls_auto_enable) auto-enables RLS on every new
-- public table. Without explicit policies below, every select returns
-- empty rows for everyone, including the public site. Policies match the
-- existing products/collections convention: public read, authenticated
-- (i.e. any logged-in admin) full access.
alter table site_content enable row level security;

drop policy if exists "site_content public read" on site_content;
create policy "site_content public read"
  on site_content for select
  to public
  using (true);

drop policy if exists "site_content authenticated write" on site_content;
create policy "site_content authenticated write"
  on site_content for all
  to authenticated
  using (true)
  with check (true);

-- Seed the two managed pages so the admin panel always has rows to render.
insert into site_content (page, content) values
  ('home', '{}'::jsonb),
  ('contact', '{}'::jsonb)
on conflict (page) do nothing;

-- Table-level GRANTs. RLS policies alone are not enough — Postgres checks
-- the base ACL first, and a table created outside the Supabase dashboard
-- does not automatically inherit the anon/authenticated grants that
-- products/collections have. Without this, every write 500s with
-- "permission denied for table site_content" even though the RLS policies
-- above are satisfied.
grant select on public.site_content to anon;
grant select, insert, update, delete on public.site_content to authenticated;
