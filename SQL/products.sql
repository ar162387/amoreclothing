
create table if not exists products (
  id uuid default uuid_generate_v4() primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  price numeric not null,
  description text,
  collection_id uuid references collections(id),
  image_front text,
  image_back text,
  images_other text[],
  sizes text[],
  available boolean default true,
  featured boolean default false,
  created_at timestamp with time zone default now()
);
