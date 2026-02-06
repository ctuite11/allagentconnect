-- Showing requests inbox table for Success Hub read-only UI
create extension if not exists pgcrypto;

create table if not exists public.showing_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mls_number text not null,
  requester_name text not null,
  requester_email text not null,
  requester_phone text,
  message text,
  status text not null default 'new',
  assigned_to_user_id uuid,
  notes text
);

alter table public.showing_requests add column if not exists created_at timestamptz not null default now();
alter table public.showing_requests add column if not exists mls_number text;
alter table public.showing_requests add column if not exists requester_name text;
alter table public.showing_requests add column if not exists requester_email text;
alter table public.showing_requests add column if not exists requester_phone text;
alter table public.showing_requests add column if not exists message text;
alter table public.showing_requests add column if not exists status text;
alter table public.showing_requests add column if not exists assigned_to_user_id uuid;
alter table public.showing_requests add column if not exists notes text;

update public.showing_requests
set status = coalesce(status, 'new')
where status is null;

alter table public.showing_requests alter column status set default 'new';
alter table public.showing_requests alter column status set not null;

alter table public.showing_requests
  drop constraint if exists showing_requests_status_check;

alter table public.showing_requests
  add constraint showing_requests_status_check
  check (status in ('new', 'in_progress', 'scheduled', 'completed', 'closed'));

create index if not exists idx_showing_requests_created_at_desc on public.showing_requests (created_at desc);
create index if not exists idx_showing_requests_mls_number on public.showing_requests (mls_number);
create index if not exists idx_showing_requests_status on public.showing_requests (status);
