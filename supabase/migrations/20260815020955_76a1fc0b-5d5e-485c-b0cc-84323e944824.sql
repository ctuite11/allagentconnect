-- ============================================================
-- New Developments MVP — 06: sales contacts (routing SSOT)
-- ============================================================

create table public.development_sales_contacts (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null,
  account_id uuid not null,
  name text not null,
  email text,
  phone text,
  title text,
  role text not null default 'sales_associate'
    check (role in ('sales_director','sales_associate','onsite_concierge','marketing','other')),
  headshot_url text,
  bio text,
  user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  is_primary boolean not null default false,
  receives_leads boolean not null default true,
  receives_showing_requests boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, development_id),
  check (email is not null or phone is not null)
);
alter table public.development_sales_contacts
  add constraint development_sales_contacts_development_fk
  foreign key (development_id, account_id)
  references public.developments(id, account_id) on update cascade on delete cascade;
create unique index uq_development_contact_email
  on public.development_sales_contacts(development_id, lower(email)) where email is not null;
create unique index uq_development_primary_contact
  on public.development_sales_contacts(development_id) where is_primary and is_active;

grant select on public.development_sales_contacts to authenticated;
grant insert (development_id, account_id, name, email, phone, title, role, headshot_url, bio,
              user_id, is_active, is_primary, receives_leads, receives_showing_requests, sort_order)
  on public.development_sales_contacts to authenticated;
grant update (name, email, phone, title, role, headshot_url, bio, user_id, is_active, is_primary,
              receives_leads, receives_showing_requests, sort_order)
  on public.development_sales_contacts to authenticated;
grant delete on public.development_sales_contacts to authenticated;
grant all on public.development_sales_contacts to service_role;
alter table public.development_sales_contacts enable row level security;

create trigger trg_development_sales_contacts_stamp
before insert or update on public.development_sales_contacts
for each row execute function public.stamp_development_child_common();

create policy "Eligible agents read active contacts on published developments"
on public.development_sales_contacts for select to authenticated
using (is_active and public.can_agent_view_development(development_id));

create policy "Members read their contacts"
on public.development_sales_contacts for select to authenticated
using (public.is_development_member(account_id) or public.has_role(auth.uid(),'admin'));

create policy "Owners and editors write contacts"
on public.development_sales_contacts for all to authenticated
using ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'))
with check ((public.is_development_member(account_id, array['owner','editor'])
        and public.is_development_account_active(account_id))
       or public.has_role(auth.uid(),'admin'));

-- === ROLLBACK ===
-- drop trigger trg_development_sales_contacts_stamp on public.development_sales_contacts;
-- drop table public.development_sales_contacts;