alter table public.products
  add column if not exists new_arrival boolean not null default false,
  add column if not exists best_seller boolean not null default false;

notify pgrst, 'reload schema';
