create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price numeric(12, 2) not null check (price > 0),
  badge text not null default '',
  image text not null,
  second_image text,
  description text not null default '',
  details text not null default '',
  fabric text not null default '',
  colors jsonb not null default '[]'::jsonb,
  color_names jsonb not null default '[]'::jsonb,
  sizes jsonb not null default '[]'::jsonb,
  new_arrival boolean not null default false,
  is_new boolean not null default false,
  best_seller boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

drop policy if exists "Anyone can view products" on public.products;
create policy "Anyone can view products"
  on public.products
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Store admin can insert products" on public.products;
create policy "Store admin can insert products"
  on public.products
  for insert
  to authenticated
  with check (
    lower(auth.jwt() ->> 'email') = 'rabiukehindeilesanmi@gmail.com'
  );

drop policy if exists "Store admin can update products" on public.products;
create policy "Store admin can update products"
  on public.products
  for update
  to authenticated
  using (
    lower(auth.jwt() ->> 'email') = 'rabiukehindeilesanmi@gmail.com'
  )
  with check (
    lower(auth.jwt() ->> 'email') = 'rabiukehindeilesanmi@gmail.com'
  );

drop policy if exists "Store admin can delete products" on public.products;
create policy "Store admin can delete products"
  on public.products
  for delete
  to authenticated
  using (
    lower(auth.jwt() ->> 'email') = 'rabiukehindeilesanmi@gmail.com'
  );

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Anyone can view product images" on storage.objects;
create policy "Anyone can view product images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Store admin can upload product images" on storage.objects;
create policy "Store admin can upload product images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and lower(auth.jwt() ->> 'email') = 'rabiukehindeilesanmi@gmail.com'
  );

drop policy if exists "Store admin can update product images" on storage.objects;
create policy "Store admin can update product images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and lower(auth.jwt() ->> 'email') = 'rabiukehindeilesanmi@gmail.com'
  )
  with check (
    bucket_id = 'product-images'
    and lower(auth.jwt() ->> 'email') = 'rabiukehindeilesanmi@gmail.com'
  );

drop policy if exists "Store admin can delete product images" on storage.objects;
create policy "Store admin can delete product images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and lower(auth.jwt() ->> 'email') = 'rabiukehindeilesanmi@gmail.com'
  );
