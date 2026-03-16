
-- Create the storage bucket for products
insert into storage.buckets (id, name, public)
values ('products', 'products', true);

-- Policy to allow public read access to the products bucket
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'products' );

-- Policy to allow authenticated users to upload to the products bucket
create policy "Authenticated Upload Access"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'products' );

-- Policy to allow authenticated users to update their uploads in the products bucket
create policy "Authenticated Update Access"
  on storage.objects for update
  to authenticated
  using ( bucket_id = 'products' );

-- Policy to allow authenticated users to delete their uploads in the products bucket
create policy "Authenticated Delete Access"
  on storage.objects for delete
  to authenticated
  using ( bucket_id = 'products' );
