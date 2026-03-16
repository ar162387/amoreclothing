-- Create orders table
create table if not exists orders (
  id uuid default uuid_generate_v4() primary key,
  customer_email_or_phone text not null,
  customer_first_name text not null,
  customer_last_name text not null,
  customer_address text not null,
  customer_apartment text,
  customer_city text not null,
  payment_method text not null check (payment_method in ('cash', 'card')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  subtotal numeric not null,
  shipping numeric not null default 0,
  total numeric not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create order_items table
create table if not exists order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  size text not null,
  quantity integer not null check (quantity > 0),
  price numeric not null,
  created_at timestamp with time zone default now()
);

-- Create index for faster queries
create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_order_items_order_id on order_items(order_id);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to automatically update updated_at
create trigger update_orders_updated_at
  before update on orders
  for each row
  execute function update_updated_at_column();
