-- ============================================================
-- New Developments MVP — 08: sales RPCs, engagement summary,
-- notification-retry support, rate-limit retention fix
-- ============================================================

-- ---------- Sales inventory reader ----------
create or replace function public.get_development_sales_inventory(_development_id uuid)
returns table(
  unit_id uuid, unit_number text, phase_name text, floor_plan_name text,
  floor text, beds numeric, baths numeric, sqft int, price numeric, status text
)
language sql stable security definer set search_path = public
as $$
  select u.id, u.unit_number, p.name, f.name, u.floor, u.beds, u.baths, u.sqft, u.price, u.status
  from public.development_units u
  join public.development_buildings_phases p on p.id = u.building_phase_id
  left join public.development_floor_plans f on f.id = u.floor_plan_id
  where u.development_id = _development_id
    and (
      public.is_development_member(public.development_account_id(_development_id),
        array['owner','editor','sales','viewer'])
      or public.has_role(auth.uid(),'admin')
    );
$$;
revoke all on function public.get_development_sales_inventory(uuid) from public, anon;
grant execute on function public.get_development_sales_inventory(uuid) to authenticated, service_role;

-- ---------- Narrow sales writer (guardrail G1) ----------
create type public.development_unit_write_result as (
  unit_id uuid,
  status text,
  price numeric,
  status_changed_at timestamptz,
  price_changed_at timestamptz,
  updated_at timestamptz
);

create or replace function public.set_development_unit_status_price(
  _unit_id uuid, _status text default null,
  _price numeric default null, _clear_price boolean default false
) returns public.development_unit_write_result
language plpgsql volatile security definer set search_path = public as $$
declare
  v_unit public.development_units;
  v_out  public.development_unit_write_result;
  v_is_admin boolean := public.has_role(auth.uid(),'admin')
                        or public.current_request_role() = 'service_role';
begin
  if _clear_price and _price is not null then
    raise exception 'Pass either _price or _clear_price, not both';
  end if;

  select * into v_unit from public.development_units where id = _unit_id for update;
  if not found then raise exception 'Unit not found'; end if;

  if not v_is_admin then
    if not public.is_development_member(v_unit.account_id, array['owner','editor','sales']) then
      raise exception 'Not authorized';
    end if;
    -- Guardrail G1: a disabled account is read-only for its members, including here.
    if not public.is_development_account_active(v_unit.account_id) then
      raise exception 'This development account is disabled';
    end if;
  end if;

  if _status is not null and _status not in
     ('available','reserved','under_agreement','sold','coming_soon') then
    raise exception 'Invalid unit status';
  end if;
  if _price is not null and _price < 0 then raise exception 'Invalid price'; end if;

  update public.development_units
     set status = coalesce(_status, status),
         price  = case when _clear_price then null
                       when _price is not null then _price
                       else price end
   where id = _unit_id
  returning id, status, price, status_changed_at, price_changed_at, updated_at into v_out;

  return v_out;
end $$;
revoke all on function public.set_development_unit_status_price(uuid, text, numeric, boolean) from public, anon;
grant execute on function public.set_development_unit_status_price(uuid, text, numeric, boolean) to authenticated, service_role;

-- ---------- Aggregate engagement (no agent identity) ----------
create or replace function public.get_development_engagement_summary(_development_id uuid)
returns table(saves_count int, shares_count int, leads_count int, showings_count int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.development_saves s where s.development_id = _development_id),
    (select count(*)::int from public.development_shares s where s.development_id = _development_id),
    (select count(*)::int from public.development_leads l where l.development_id = _development_id),
    (select count(*)::int from public.development_showing_requests r where r.development_id = _development_id)
  where public.is_development_member(public.development_account_id(_development_id))
     or public.has_role(auth.uid(),'admin');
$$;
revoke all on function public.get_development_engagement_summary(uuid) from public, anon;
grant execute on function public.get_development_engagement_summary(uuid) to authenticated, service_role;

-- ---------- Notification retry support (review item 8) ----------
-- Service-role only. Feeds the same-row retry path implemented in
-- supabase/functions/_shared/developmentNotify.ts.
create or replace function public.list_development_submissions_awaiting_notification(
  _kind text, _limit int default 50
)
returns table(id uuid, development_id uuid, account_id uuid, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_request_role() <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if _kind = 'lead' then
    return query
      select l.id, l.development_id, l.account_id, l.created_at
      from public.development_leads l
      join public.development_accounts a on a.id = l.account_id
      where l.notified_at is null
        and a.is_active   -- Review item 3 (Draft 3): never notify for a disabled account
      order by l.created_at
      limit greatest(1, least(_limit, 200));
  elsif _kind = 'showing' then
    return query
      select r.id, r.development_id, r.account_id, r.created_at
      from public.development_showing_requests r
      join public.development_accounts a on a.id = r.account_id
      where r.notified_at is null
        and a.is_active
      order by r.created_at
      limit greatest(1, least(_limit, 200));
  else
    raise exception 'Unknown submission kind: %', _kind;
  end if;
end $$;
revoke all on function public.list_development_submissions_awaiting_notification(text, int) from public, anon, authenticated;
grant execute on function public.list_development_submissions_awaiting_notification(text, int) to service_role;

-- ---------- Rate-limit retention (review item 8b) ----------
-- The 24-hour development submission quota needs its window row to survive the
-- cleanup sweep. Retention moves from 1 hour to 25 hours; nothing else changes.
create or replace function public.rate_limits_cleanup()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.rate_limits
  where updated_at < now() - interval '25 hours';
end;
$$;
revoke all on function public.rate_limits_cleanup() from public, anon, authenticated;
grant execute on function public.rate_limits_cleanup() to service_role;

-- === ROLLBACK ===
-- Restore the previous 1-hour retention body:
--   CREATE OR REPLACE FUNCTION public.rate_limits_cleanup() RETURNS void
--   LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
--   BEGIN DELETE FROM public.rate_limits WHERE updated_at < now() - interval '1 hour'; END; $$;
-- drop function public.list_development_submissions_awaiting_notification(text, int);
-- drop function public.get_development_engagement_summary(uuid);
-- drop function public.set_development_unit_status_price(uuid, text, numeric, boolean);
-- drop type public.development_unit_write_result;
-- drop function public.get_development_sales_inventory(uuid);