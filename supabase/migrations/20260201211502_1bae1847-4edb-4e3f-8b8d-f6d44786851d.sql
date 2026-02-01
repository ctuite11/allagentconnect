-- Phase 2: Add agent-owner RLS policies to agent_proposal_incentives
-- Preserves existing admin policy, adds owner access

alter table public.agent_proposal_incentives enable row level security;

-- Agents can SELECT their own row
drop policy if exists "Agents can read own incentives" on public.agent_proposal_incentives;
create policy "Agents can read own incentives"
on public.agent_proposal_incentives
for select
using (auth.uid() = agent_id);

-- Agents can INSERT their own row
drop policy if exists "Agents can insert own incentives" on public.agent_proposal_incentives;
create policy "Agents can insert own incentives"
on public.agent_proposal_incentives
for insert
with check (auth.uid() = agent_id);

-- Agents can UPDATE their own row (WITH CHECK prevents agent_id tampering)
drop policy if exists "Agents can update own incentives" on public.agent_proposal_incentives;
create policy "Agents can update own incentives"
on public.agent_proposal_incentives
for update
using (auth.uid() = agent_id)
with check (auth.uid() = agent_id);