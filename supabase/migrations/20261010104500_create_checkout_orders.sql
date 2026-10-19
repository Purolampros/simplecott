create table if not exists public.simplecott_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references auth.users (id) on delete restrict,
  email text not null,
  currency text not null default 'NGN' check (currency = 'NGN'),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  shipping numeric(12, 2) not null check (shipping >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  total_amount numeric(12, 2) not null check (total_amount > 0),
  items jsonb not null,
  delivery_details jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  flutterwave_transaction_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists simplecott_orders_user_created_idx
  on public.simplecott_orders (user_id, created_at desc);

alter table public.simplecott_orders enable row level security;
