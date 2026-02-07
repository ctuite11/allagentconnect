create table if not exists public.showing_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mls_number text not null,
  requester_name text not null,
  requester_email text not null,
  requester_phone text null,
  message text null,
  status text not null default 'new' check (status in ('new','in_progress','scheduled','completed','closed')),
  assigned_to_user_id uuid null,
  notes text null
);

create index if not exists showing_requests_created_at_idx
  on public.showing_requests (created_at desc);

create index if not exists showing_requests_mls_number_idx
  on public.showing_requests (mls_number);

create index if not exists showing_requests_status_idx
  on public.showing_requests (status);
