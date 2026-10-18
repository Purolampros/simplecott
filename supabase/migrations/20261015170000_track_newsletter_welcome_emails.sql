create table if not exists public.newsletter_welcome_deliveries (
  email text primary key
    references public.newsletter_subscribers (email)
    on delete cascade,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'failed')),
  updated_at timestamptz not null default now()
);

alter table public.newsletter_welcome_deliveries enable row level security;
revoke all on public.newsletter_welcome_deliveries from anon, authenticated;
grant all on public.newsletter_welcome_deliveries to service_role;
