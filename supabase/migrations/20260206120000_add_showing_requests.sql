create table if not exists public.showing_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  mls_number text not null,
  listing_address text null,
  listing_city text null,
  listing_state text null,
  listing_zip text null,

  requester_name text not null,
  requester_email text not null,
  requester_phone text null,
  message text null,

  preferred_dates text null,
  preferred_time_window text null,

  listing_agent_name text null,
  listing_agent_phone text null,
  listing_agent_email text null,

  status text not null default 'new'
);

create index if not exists showing_requests_mls_number_idx
on public.showing_requests (mls_number);
