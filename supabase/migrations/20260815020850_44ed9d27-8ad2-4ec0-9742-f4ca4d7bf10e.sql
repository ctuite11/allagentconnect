-- ============================================================
-- New Developments MVP — 04: project updates
-- ============================================================

create table public.development_updates (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null,
  account_id uuid not null,
  kind text not null check (kind in ('construction','sales','design','general')),
  title text not null,
  body_markdown text not null,
  posted_at timestamptz not null default now(),
  is_published boolean not null default false,
  published_at timestamptz,
  is_pinned boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, development_id)
);
alter table public.development_updates
  add constraint development_updates_development_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;
create unique index uq_development_update_pinned
  on public.development_updates(development_id) where is_pinned;
create index idx_development_updates_development on public.development_updates(development_id, posted_at desc);

grant select on public.development_updates to authenticated;
grant insert (development_id, account_id, kind, title, body_markdown, posted_at, is_published, is_pinned)
  on public.development_updates to authenticated;
grant update (kind, title, body_markdown, posted_at, is_published, is_pinned)
  on public.development_updates to authenticated;   -- published_at / audit columns are server-stamped
grant delete on public.development_updates to authenticated;
grant all on public.development_updates to service_role;
alter table public.development_updates enable row level security;

create trigger trg_development_updates_audit
before insert or update on public.development_updates
for each row execute function public.stamp_development_child_audit();

create or replace function public.guard_development_update_content()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.body_markdown ~* '<[a-z!/][^>]*>' then
    raise exception 'body_markdown must be Markdown; raw HTML is not allowed';
  end if;

  if tg_op = 'INSERT' then
    new.published_at := case when new.is_published then now() else null end;
  else
    if old.published_at is not null then
      new.published_at := old.published_at;          -- never rewritten
    elsif new.is_published and not old.is_published then
      new.published_at := now();                     -- first publish only
    else
      new.published_at := old.published_at;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_development_update_content() from public, anon, authenticated;

create trigger trg_development_update_content
before insert or update on public.development_updates
for each row execute function public.guard_development_update_content();

create policy "Eligible agents read published updates"
on public.development_updates for select to authenticated
using (is_published and public.can_agent_view_development(development_id));

create policy "Members read their updates"
on public.development_updates for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Owners and editors write updates"
on public.development_updates for all to authenticated
using ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));

-- === ROLLBACK ===
-- drop trigger trg_development_update_content on public.development_updates;
-- drop trigger trg_development_updates_audit on public.development_updates;
-- drop table public.development_updates;
-- drop function public.guard_development_update_content();