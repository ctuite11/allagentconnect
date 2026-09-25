-- lovable-cron-fallback-reviewed: incident-evidence recorder explicitly approved by the user at 1-minute cadence (1,440 runs/day) to capture resource peaks before restart-triggered log wipes; each run is a tiny single-row insert + 7-day prune
-- DB capacity sampler — automatic incident-evidence recorder
--
-- Read-only-diagnostic for the app: samples live database state once per
-- minute so the resource peak immediately before a restart is preserved
-- (project logs are wiped at each restart). Strictly diagnostic:
-- no app behavior change, no email, no capacity change, no restart automation.

create table public.db_capacity_samples (
  id bigint generated always as identity primary key,
  sampled_at timestamptz not null default now(),
  total_connections int not null,
  active_connections int not null,
  idle_connections int not null,
  longest_transaction_seconds numeric(12, 3) not null default 0,
  postmaster_uptime_seconds bigint not null default 0,
  database_size_bytes bigint not null default 0,
  wal_size_bytes bigint not null default 0,
  max_connections_setting int,
  shared_buffers_setting text,
  work_mem_setting text,
  effective_cache_size_setting text,
  connections_by_source jsonb not null default '{}'::jsonb
);

-- Diagnostics table: never readable or writable by app users.
grant select, insert on public.db_capacity_samples to service_role;
grant all on public.db_capacity_samples to postgres;

alter table public.db_capacity_samples enable row level security;
-- No policies: locked to owner + service_role by design.

create or replace function public.sample_db_capacity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int;
  v_active int;
  v_idle int;
  v_longest numeric;
  v_sources jsonb := '{}'::jsonb;
  v_row record;
  v_wal bigint := 0;
  v_uptime bigint := 0;
  v_db_size bigint := 0;
  v_max_conn int := null;
  v_shared_buffers text := null;
  v_work_mem text := null;
  v_eff_cache text := null;
begin
  select
    count(*),
    count(*) filter (where state = 'active'),
    count(*) filter (where state = 'idle'),
    coalesce(max(extract(epoch from (now() - xact_start))), 0)
  into v_total, v_active, v_idle, v_longest
  from pg_catalog.pg_stat_activity
  where datname = current_database();

  for v_row in
    select coalesce(application_name, 'unknown') as app, usename, count(*) as c
    from pg_catalog.pg_stat_activity
    where datname = current_database()
    group by 1, 2
  loop
    v_sources := v_sources || jsonb_build_object(v_row.app || ':' || v_row.usename, v_row.c);
  end loop;

  begin
    v_uptime := extract(epoch from (now() - pg_catalog.pg_postmaster_start_time()))::bigint;
  exception when others then v_uptime := 0;
  end;

  begin
    v_db_size := pg_catalog.pg_database_size(current_database());
  exception when others then v_db_size := 0;
  end;

  begin
    select coalesce(sum(size), 0) into v_wal from pg_catalog.pg_ls_waldir();
  exception when others then v_wal := 0;
  end;

  begin
    select
      max(case when name = 'max_connections' then setting::int end),
      max(case when name = 'shared_buffers' then unit end),
      max(case when name = 'work_mem' then unit end),
      max(case when name = 'effective_cache_size' then unit end)
    into v_max_conn, v_shared_buffers, v_work_mem, v_eff_cache
    from pg_catalog.pg_settings
    where name in ('max_connections', 'shared_buffers', 'work_mem', 'effective_cache_size');
  exception when others then
    v_max_conn := null;
    v_shared_buffers := null;
    v_work_mem := null;
    v_eff_cache := null;
  end;

  insert into public.db_capacity_samples (
    total_connections, active_connections, idle_connections,
    longest_transaction_seconds, postmaster_uptime_seconds,
    database_size_bytes, wal_size_bytes,
    max_connections_setting, shared_buffers_setting,
    work_mem_setting, effective_cache_size_setting,
    connections_by_source
  ) values (
    v_total, v_active, v_idle,
    v_longest, v_uptime,
    v_db_size, v_wal,
    v_max_conn, v_shared_buffers,
    v_work_mem, v_eff_cache,
    v_sources
  );

  -- Cap the table: keep 7 days of samples.
  delete from public.db_capacity_samples
  where sampled_at < now() - interval '7 days';
end;
$$;

revoke execute on function public.sample_db_capacity() from public;
revoke execute on function public.sample_db_capacity() from anon;
revoke execute on function public.sample_db_capacity() from authenticated;
grant execute on function public.sample_db_capacity() to postgres;

select cron.schedule(
  'db-capacity-sample-every-minute',
  '* * * * *',
  $$
  select public.sample_db_capacity();
  $$
);
