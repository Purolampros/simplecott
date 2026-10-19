create table if not exists public.newsletter_subscribers (
  email text primary key
    check (
      email = lower(email)
      and length(email) <= 254
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ),
  subscribed_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

grant insert on public.newsletter_subscribers to anon, authenticated;

drop policy if exists "Visitors can subscribe to newsletter"
  on public.newsletter_subscribers;
create policy "Visitors can subscribe to newsletter"
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (email = lower(email));
