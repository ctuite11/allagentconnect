-- ============================================================
-- New Developments MVP — 09: storage authorization
-- DRAFT 2 — NOT APPLIED.
-- NOTE: the two buckets are created with the Lovable storage tool at apply
-- time (private). The commented INSERT below documents the intended rows only;
-- direct INSERT INTO storage.buckets is not the supported path.
--   -- insert into storage.buckets (id, name, public) values
--   --   ('development-media','development-media', false),
--   --   ('development-documents','development-documents', false);
--
-- Path convention (enforced in the DB by the CHECK constraints in migration 05):
--   {development_id}/{scope}/{scope_id}/{uuid}.{ext}
-- ============================================================

create or replace function public.development_from_storage_path(_name text)
returns uuid language sql immutable set search_path = public as $$
  select nullif(split_part(_name, '/', 1), '')::uuid
$$;
revoke all on function public.development_from_storage_path(text) from public, anon;
grant execute on function public.development_from_storage_path(text) to authenticated, service_role;

-- Write predicate: owner/editor of an ACTIVE account (guardrail G1)
create or replace function public.can_write_development_object(_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.developments d
    where d.id = public.development_from_storage_path(_name)
      and public.is_development_member(d.account_id, array['owner','editor'])
      and public.is_development_account_active(d.account_id)
  ) or public.has_role(auth.uid(),'admin');
$$;
revoke all on function public.can_write_development_object(text) from public, anon;
grant execute on function public.can_write_development_object(text) to authenticated, service_role;

-- Member-read predicate: any accepted member, active or not (recovery)
create or replace function public.can_member_read_development_object(_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.developments d
    where d.id = public.development_from_storage_path(_name)
      and public.is_development_member(d.account_id)
  ) or public.has_role(auth.uid(),'admin');
$$;
revoke all on function public.can_member_read_development_object(text) from public, anon;
grant execute on function public.can_member_read_development_object(text) to authenticated, service_role;

-- Review item 4: independent path/row binding check, also used by the
-- development-document-url Edge Function before it signs anything.
create or replace function public.storage_path_belongs_to_development(_name text, _development_id uuid)
returns boolean language sql immutable set search_path = public as $$
  select _name is not null
     and _development_id is not null
     and split_part(_name, '/', 1) = _development_id::text;
$$;
revoke all on function public.storage_path_belongs_to_development(text, uuid) from public, anon;
grant execute on function public.storage_path_belongs_to_development(text, uuid) to authenticated, service_role;

-- ---------- development-media ----------
create policy "dev media agent read"
on storage.objects for select to authenticated
using (bucket_id = 'development-media'
       and public.can_agent_view_development(public.development_from_storage_path(name)));

create policy "dev media member read"
on storage.objects for select to authenticated
using (bucket_id = 'development-media'
       and public.can_member_read_development_object(name));

create policy "dev media member write"
on storage.objects for insert to authenticated
with check (bucket_id = 'development-media' and public.can_write_development_object(name));

create policy "dev media member update"
on storage.objects for update to authenticated
using (bucket_id = 'development-media' and public.can_write_development_object(name))
with check (bucket_id = 'development-media' and public.can_write_development_object(name));

create policy "dev media member delete"
on storage.objects for delete to authenticated
using (bucket_id = 'development-media' and public.can_write_development_object(name));

-- ---------- development-documents ----------
-- No client SELECT policy: bytes are reachable only through the 5-minute
-- signed URL minted by the development-document-url Edge Function.
create policy "dev docs member write"
on storage.objects for insert to authenticated
with check (bucket_id = 'development-documents' and public.can_write_development_object(name));

create policy "dev docs member update"
on storage.objects for update to authenticated
using (bucket_id = 'development-documents' and public.can_write_development_object(name))
with check (bucket_id = 'development-documents' and public.can_write_development_object(name));

create policy "dev docs member delete"
on storage.objects for delete to authenticated
using (bucket_id = 'development-documents' and public.can_write_development_object(name));

-- === ROLLBACK ===
-- drop policy "dev docs member delete" on storage.objects;
-- drop policy "dev docs member update" on storage.objects;
-- drop policy "dev docs member write" on storage.objects;
-- drop policy "dev media member delete" on storage.objects;
-- drop policy "dev media member update" on storage.objects;
-- drop policy "dev media member write" on storage.objects;
-- drop policy "dev media member read" on storage.objects;
-- drop policy "dev media agent read" on storage.objects;
-- drop function public.storage_path_belongs_to_development(text, uuid);
-- drop function public.can_member_read_development_object(text);
-- drop function public.can_write_development_object(text);
-- drop function public.development_from_storage_path(text);
-- (buckets are removed via the storage tooling, only while empty)
