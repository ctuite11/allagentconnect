-- ============================================================
-- New Developments MVP — 05: media and documents
-- Review item 4: every storage-backed row binds its object path to its
-- development_id via a CHECK constraint (first path segment), so a member of
-- Development A can never create a row pointing at an object under Development B.
-- ============================================================

create table public.development_media (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null,
  account_id uuid not null,
  floor_plan_id uuid,
  unit_id uuid,
  update_id uuid,
  kind text not null check (kind in ('photo','video','virtual_tour','video_poster')),
  source_type text not null check (source_type in ('storage','external')),
  storage_bucket text,
  storage_path text,
  external_url text,
  is_hero boolean not null default false,
  width int,
  height int,
  alt text,
  caption text,
  mime_type text,
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  sort_order int not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, development_id),
  check (
    (floor_plan_id is not null)::int
  + (unit_id is not null)::int
  + (update_id is not null)::int <= 1
  ),
  check (
    (source_type = 'storage' and storage_bucket is not null and storage_path is not null
       and external_url is null)
 or (source_type = 'external' and external_url is not null
       and storage_bucket is null and storage_path is null)
  ),
  check (not is_hero or (floor_plan_id is null and unit_id is null and update_id is null)),
  -- path binding (review item 4)
  constraint development_media_path_bound_to_development
    check (storage_path is null or split_part(storage_path, '/', 1) = development_id::text),
  constraint development_media_bucket_allowlist
    check (storage_bucket is null or storage_bucket = 'development-media')
);
alter table public.development_media
  add constraint development_media_development_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;
alter table public.development_media
  add constraint development_media_floor_plan_fk
  foreign key (floor_plan_id, development_id)
  references public.development_floor_plans(id, development_id) on delete cascade;
alter table public.development_media
  add constraint development_media_unit_fk
  foreign key (unit_id, development_id)
  references public.development_units(id, development_id) on delete cascade;
alter table public.development_media
  add constraint development_media_update_fk
  foreign key (update_id, development_id)
  references public.development_updates(id, development_id) on delete cascade;
create unique index uq_development_hero
  on public.development_media(development_id) where is_hero;
create unique index uq_development_media_object
  on public.development_media(development_id, storage_bucket, storage_path)
  where storage_path is not null;

grant select on public.development_media to authenticated;
grant insert (development_id, account_id, floor_plan_id, unit_id, update_id, kind, source_type,
              storage_bucket, storage_path, external_url, is_hero, width, height, alt, caption,
              mime_type, duration_seconds, sort_order)
  on public.development_media to authenticated;
grant update (floor_plan_id, unit_id, update_id, kind, source_type, storage_bucket, storage_path,
              external_url, is_hero, width, height, alt, caption, mime_type, duration_seconds, sort_order)
  on public.development_media to authenticated;
grant delete on public.development_media to authenticated;
grant all on public.development_media to service_role;
alter table public.development_media enable row level security;

create trigger trg_development_media_audit
before insert or update on public.development_media
for each row execute function public.stamp_development_child_audit();

create table public.development_documents (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null,
  account_id uuid not null,
  title text not null,
  description text,
  category text not null check (category in (
    'brochure','floor_plan','site_plan','spec_sheet','finish_package','disclosure',
    'condo_docs','deposit_schedule',
    'broker_registration','buyer_agent_compensation','commission_bonus',
    'showing_tour_procedure','sales_office_hours','offer_submission',
    'other'
  )),
  access text not null default 'agent_only' check (access in ('agent_only','public_marketing')),
  is_featured_agent_resource boolean not null default false,
  floor_plan_id uuid,
  unit_id uuid,
  storage_path text not null,
  byte_size bigint,
  mime_type text,
  sort_order int not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, development_id),
  unique (development_id, storage_path),
  check ((floor_plan_id is not null)::int + (unit_id is not null)::int <= 1),
  -- path binding (review item 4)
  constraint development_documents_path_bound_to_development
    check (split_part(storage_path, '/', 1) = development_id::text)
);
alter table public.development_documents
  add constraint development_documents_development_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;
alter table public.development_documents
  add constraint development_documents_floor_plan_fk
  foreign key (floor_plan_id, development_id)
  references public.development_floor_plans(id, development_id) on delete set null;
alter table public.development_documents
  add constraint development_documents_unit_fk
  foreign key (unit_id, development_id)
  references public.development_units(id, development_id) on delete set null;

grant select on public.development_documents to authenticated;
grant insert (development_id, account_id, title, description, category, access,
              is_featured_agent_resource, floor_plan_id, unit_id, storage_path, byte_size,
              mime_type, sort_order)
  on public.development_documents to authenticated;
grant update (title, description, category, access, is_featured_agent_resource, floor_plan_id,
              unit_id, storage_path, byte_size, mime_type, sort_order)
  on public.development_documents to authenticated;
grant delete on public.development_documents to authenticated;
grant all on public.development_documents to service_role;
alter table public.development_documents enable row level security;

create trigger trg_development_documents_audit
before insert or update on public.development_documents
for each row execute function public.stamp_development_child_audit();

-- Policies -----------------------------------------------------------------
create policy "Eligible agents read media on published developments"
on public.development_media for select to authenticated
using (public.can_agent_view_development(development_id));

create policy "Members read their media"
on public.development_media for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Owners and editors write media"
on public.development_media for all to authenticated
using ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));

-- Document metadata only. Bytes are reachable exclusively through the
-- development-document-url Edge Function's 5-minute signed URL.
create policy "Eligible agents read document metadata on published developments"
on public.development_documents for select to authenticated
using (public.can_agent_view_development(development_id));

create policy "Members read their documents"
on public.development_documents for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Owners and editors write documents"
on public.development_documents for all to authenticated
using ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));

-- === ROLLBACK ===
-- drop trigger trg_development_documents_audit on public.development_documents;
-- drop trigger trg_development_media_audit on public.development_media;
-- drop table public.development_documents;
-- drop table public.development_media;