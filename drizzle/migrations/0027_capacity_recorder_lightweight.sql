CREATE INDEX IF NOT EXISTS db_capacity_samples_sampled_at_idx ON public.db_capacity_samples (sampled_at);

CREATE OR REPLACE FUNCTION public.sample_db_capacity()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    select coalesce(nullif(application_name, ''), 'unknown') as app, coalesce(usename::text, 'unknown') as usename, count(*) as c
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
  -- Retention is handled by the separate hourly job db-capacity-prune-hourly.
end;
$function$;

CREATE OR REPLACE FUNCTION public.prune_db_capacity_samples()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_deleted integer;
begin
  delete from public.db_capacity_samples
  where sampled_at < now() - interval '7 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

REVOKE ALL ON FUNCTION public.prune_db_capacity_samples() FROM PUBLIC, anon, authenticated;