
create table if not exists collections (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  season text not null,
  description text,
  created_at timestamp with time zone default now()
);
