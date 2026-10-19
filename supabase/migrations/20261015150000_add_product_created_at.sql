alter table public.products
  add column if not exists created_at timestamptz not null default now();

create index if not exists products_created_at_desc_idx
  on public.products (created_at desc);

notify pgrst, 'reload schema';
