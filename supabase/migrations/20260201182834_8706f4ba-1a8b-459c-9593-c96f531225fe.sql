-- ================================================
-- MIGRATION: Agent Proposals Backend (Dark Launch)
-- ================================================

-- Ensure gen_random_uuid() exists
create extension if not exists pgcrypto;

-- 1. FEATURE FLAGS TABLE
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_name text unique not null,
  enabled boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

drop policy if exists "Admins can manage feature flags" on public.feature_flags;
create policy "Admins can manage feature flags"
on public.feature_flags
for all
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

insert into public.feature_flags (flag_name, enabled, description)
values ('FEATURE_AGENT_PROPOSALS', false,
        'Gates buyer/seller agent proposal feature. When false, all proposal logic is dormant.')
on conflict (flag_name) do nothing;

-- 2. HELPER FUNCTION (not called yet; returns false if flag not visible)
create or replace function public.is_feature_enabled(p_flag_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select enabled from public.feature_flags where flag_name = p_flag_name),
    false
  )
$$;

-- 3. EXTEND AGENT_SETTINGS (default OFF)
alter table public.agent_settings
  add column if not exists show_buyer_proposal boolean not null default false,
  add column if not exists show_seller_proposal boolean not null default false;

-- 4. AGENT PROPOSAL INCENTIVES TABLE (data only; no UI)
create table if not exists public.agent_proposal_incentives (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_profiles(id) on delete cascade,
  buyer_fee_credit_type text check (buyer_fee_credit_type in ('percentage', 'flat')),
  buyer_fee_credit_value numeric(10,2),
  listing_commission_type text check (listing_commission_type in ('percentage', 'flat', 'hybrid')),
  listing_commission_value numeric(10,2),
  flat_fee_option boolean not null default false,
  flat_fee_amount numeric(12,2),
  custom_incentive_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id)
);

alter table public.agent_proposal_incentives enable row level security;

drop policy if exists "Admins can manage proposal incentives" on public.agent_proposal_incentives;
create policy "Admins can manage proposal incentives"
on public.agent_proposal_incentives
for all
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 5. BUYER QUALIFICATIONS TABLE (data only; no UI)
create table if not exists public.buyer_qualifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  qualification_method text check (qualification_method in ('pre_approval', 'proof_of_funds', 'documentation_agreement')),
  pre_approval_uploaded boolean not null default false,
  pre_approval_file_path text,
  proof_of_funds_uploaded boolean not null default false,
  proof_of_funds_file_path text,
  documentation_agreed boolean not null default false,
  documentation_agreed_at timestamptz,
  receive_agent_proposals boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.buyer_qualifications enable row level security;

drop policy if exists "Admins can manage buyer qualifications" on public.buyer_qualifications;
create policy "Admins can manage buyer qualifications"
on public.buyer_qualifications
for all
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 6. EXTEND AGENT_MATCH_SUBMISSIONS (default OFF; must not affect flow)
alter table public.agent_match_submissions
  add column if not exists receive_listing_proposals boolean not null default false;