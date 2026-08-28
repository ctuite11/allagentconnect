create or replace function public.get_system_health()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with
  monitored_jobs as (
    select j.jobid, j.jobname, j.schedule, j.active
    from cron.job j
    where j.jobname in (
      'process-email-queue-every-minute',
      'process-hot-sheet-events-every-minute',
      'process-comms-digests'
    )
  ),
  last_success as (
    select d.jobid, max(d.end_time) as last_success_at
    from cron.job_run_details d
    where d.status = 'succeeded'
    group by d.jobid
  ),
  last_run as (
    select distinct on (d.jobid) d.jobid, d.start_time, d.status
    from cron.job_run_details d
    order by d.jobid, d.start_time desc
  ),
  cron_health as (
    select jsonb_object_agg(
      mj.jobname,
      jsonb_build_object(
        'active', mj.active,
        'schedule', mj.schedule,
        'last_successful_run_at', ls.last_success_at,
        'seconds_since_success',
          case when ls.last_success_at is null then null
               else floor(extract(epoch from (now() - ls.last_success_at)))::bigint end,
        'last_run_at', lr.start_time,
        'last_run_status', lr.status
      )
    ) as jobs
    from monitored_jobs mj
    left join last_success ls on ls.jobid = mj.jobid
    left join last_run lr on lr.jobid = mj.jobid
  ),
  inactive_jobs as (
    select coalesce(jsonb_agg(j.jobname order by j.jobname), '[]'::jsonb) as names
    from cron.job j
    where not j.active
  ),
  streams as (
    select unnest(array[
      'hot_sheet','communications','transactional','system','development_notifications'
    ]) as stream
  ),
  queue as (
    select
      s.stream,
      count(*) filter (where e.status = 'queued') as queued_count,
      count(*) filter (where e.status = 'queued' and e.run_after <= now()) as due_queued_count,
      floor(extract(epoch from (now() - min(e.run_after)
        filter (where e.status = 'queued' and e.run_after <= now()))))::bigint
        as oldest_due_age_seconds,
      count(*) filter (where e.status = 'processing') as processing_count,
      count(*) filter (
        where e.status = 'processing' and e.created_at < now() - interval '15 minutes'
      ) as stuck_processing_count,
      floor(extract(epoch from (now() - min(e.created_at)
        filter (where e.status = 'processing'))))::bigint as oldest_processing_age_seconds,
      count(*) filter (
        where e.status = 'failed' and e.created_at > now() - interval '15 minutes'
      ) as recent_failed_count
    from streams s
    left join public.email_jobs e on e.stream = s.stream
    group by s.stream
  ),
  queue_json as (
    select jsonb_object_agg(
      q.stream,
      jsonb_build_object(
        'queued_count', q.queued_count,
        'due_queued_count', q.due_queued_count,
        'oldest_due_age_seconds', coalesce(q.oldest_due_age_seconds, 0),
        'processing_count', q.processing_count,
        'stuck_processing_count', q.stuck_processing_count,
        'oldest_processing_age_seconds', coalesce(q.oldest_processing_age_seconds, 0),
        'recent_failed_count', q.recent_failed_count
      )
    ) as streams
    from queue q
  ),
  outbox as (
    select
      count(*) filter (where state = 'pending') as pending_count,
      floor(extract(epoch from (now() - min(created_at)
        filter (where state = 'pending'))))::bigint as oldest_pending_age_seconds,
      count(*) filter (where state = 'claimed') as claimed_count,
      count(*) filter (
        where state = 'claimed' and lease_expires_at is not null and lease_expires_at < now()
      ) as lease_expired_count,
      count(*) filter (where state = 'paused_held') as paused_held_count,
      count(*) filter (
        where state = 'failed' and updated_at > now() - interval '60 minutes'
      ) as recent_failed_count
    from public.hot_sheet_listing_events
  )
  select jsonb_build_object(
    'generated_at', now(),
    'cron', (select jobs from cron_health),
    'inactive_cron_jobs', (select names from inactive_jobs),
    'email_queue', jsonb_build_object('streams', (select streams from queue_json)),
    'hot_sheet_outbox', (
      select jsonb_build_object(
        'pending_count', o.pending_count,
        'oldest_pending_age_seconds', coalesce(o.oldest_pending_age_seconds, 0),
        'claimed_count', o.claimed_count,
        'lease_expired_count', o.lease_expired_count,
        'paused_held_count', o.paused_held_count,
        'recent_failed_count', o.recent_failed_count
      ) from outbox o
    )
  );
$$;

revoke all on function public.get_system_health() from public;
revoke all on function public.get_system_health() from anon;
revoke all on function public.get_system_health() from authenticated;
grant execute on function public.get_system_health() to service_role;

comment on function public.get_system_health() is
  'Read-only operational health metrics for the system-health monitoring endpoint. service_role only. No PII.';