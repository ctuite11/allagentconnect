
-- 0) Safety: ensure RLS is on
alter table public.buyer_workspace_invites enable row level security;

-- 1) Replace is_buyer_workspace_owner to use buyer_workspaces.owner_id directly
create or replace function public.is_buyer_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.buyer_workspaces bw
    where bw.id = p_workspace_id
      and bw.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_buyer_workspace_owner(uuid) from public;
grant execute on function public.is_buyer_workspace_owner(uuid) to authenticated;

-- 2) Drop old agent-centric policies
drop policy if exists "Agents can create buyer workspace invites" on public.buyer_workspace_invites;
drop policy if exists "Agents can view own buyer workspace invites" on public.buyer_workspace_invites;
drop policy if exists "Agents can update own buyer workspace invites" on public.buyer_workspace_invites;
drop policy if exists "Agents can delete own buyer workspace invites" on public.buyer_workspace_invites;
drop policy if exists "Clients can accept buyer workspace invite" on public.buyer_workspace_invites;

-- 3) Create buyer-workspace scoped policies

drop policy if exists "Workspace owners can view invites" on public.buyer_workspace_invites;
create policy "Workspace owners can view invites"
on public.buyer_workspace_invites
for select
to authenticated
using (
  public.is_buyer_workspace_owner(workspace_id)
);

drop policy if exists "Workspace owners can create invites" on public.buyer_workspace_invites;
create policy "Workspace owners can create invites"
on public.buyer_workspace_invites
for insert
to authenticated
with check (
  public.is_buyer_workspace_owner(workspace_id)
  and created_by_user_id = auth.uid()
);

drop policy if exists "Workspace owners can delete pending invites" on public.buyer_workspace_invites;
create policy "Workspace owners can delete pending invites"
on public.buyer_workspace_invites
for delete
to authenticated
using (
  public.is_buyer_workspace_owner(workspace_id)
  and accepted_at is null
);

-- 4) Acceptance consistency constraint
alter table public.buyer_workspace_invites
drop constraint if exists buyer_workspace_invites_acceptance_chk;

alter table public.buyer_workspace_invites
add constraint buyer_workspace_invites_acceptance_chk
check (
  (accepted_at is null and accepted_by_user_id is null)
  or (accepted_at is not null and accepted_by_user_id is not null)
);
