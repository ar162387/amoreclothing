-- Stable public product URLs. UUIDs remain the internal primary key and Product schema SKU.
alter table public.products add column if not exists slug text;

update public.products
set slug = case upper(name)
  when 'THE FOREST ACCORD' then 'the-forest-accord'
  when 'THE IVORY EQUATION' then 'the-ivory-equation'
  when 'THE MERIDIAN PALE' then 'the-meridian-pale'
  when 'THE SAGE HOUR' then 'the-sage-hour'
  when 'THE MIDNIGHT ARC' then 'the-midnight-arc'
  else trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
end
where slug is null;

alter table public.products
  alter column slug set not null,
  add constraint products_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create unique index if not exists products_slug_key on public.products (slug);
