

# Ticket 11: Schedule `update-listing-statuses` to Run Automatically

## What This Does

The `update-listing-statuses` backend function already handles two critical automations:
- **Auto-activate**: Flips `coming_soon`/`new` listings to `active` when their scheduled go-live date arrives
- **Auto-expire**: Flips `active` listings to `expired` when their expiration date passes

But nothing calls it on a schedule. This ticket wires up a database-level cron job to invoke the function every 15 minutes.

## Current State

- The backend function exists and works correctly when called manually
- It has no authentication requirement (`verify_jwt = false` in `supabase/config.toml`)
- The required database extensions (`pg_cron` for scheduling, `pg_net` for HTTP calls) are **not yet enabled**
- No cron jobs exist in the database

## Implementation Steps

### Step 1: Enable required extensions (database migration)

A database migration will enable `pg_cron` and `pg_net` using the Supabase-standard `extensions` schema:

```text
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
```

No extra GRANT statements are needed -- Supabase managed environments handle permissions automatically.

### Step 2: Create the cron job (direct SQL, not a migration)

This must be run as a direct SQL statement because it contains the project-specific function URL and should not be included in portable migrations.

```text
select cron.schedule(
  'update-listing-statuses-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://qocduqtfbsevnhlgsfka.supabase.co/functions/v1/update-listing-statuses',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

No Authorization header is needed because the function has `verify_jwt = false`.

### Step 3: Verify the job was created

After setup, verification queries confirm the job is registered:

```text
-- Confirm job exists
select jobid, jobname, schedule from cron.job;

-- Check run history after first execution
select * from cron.job_run_details
where jobid in (select jobid from cron.job where jobname = 'update-listing-statuses-every-15-min')
order by start_time desc limit 10;
```

## What Does NOT Change

- No changes to the `update-listing-statuses` edge function code
- No changes to any frontend pages
- No changes to listing creation or editing
- No new tables or columns

## Rollback

If needed, the job can be removed with:
```text
select cron.unschedule('update-listing-statuses-every-15-min');
```

## Acceptance Checklist

- `pg_cron` and `pg_net` extensions are enabled
- Cron job `update-listing-statuses-every-15-min` exists and runs every 15 minutes
- A `coming_soon` listing with `auto_activate_on <= now()` automatically flips to `active`
- An `active` listing with `expiration_date <= today` automatically flips to `expired`
- `listing_status_history` gets a row for each automated change
- `cron.job_run_details` shows successful runs

## Technical Notes

- The extensions migration uses `with schema extensions` (Supabase standard), not `pg_catalog`
- No GRANT statements are needed in Supabase managed environments
- The cron job SQL is run as a direct SQL insert (not a migration) because it contains the project-specific function URL
- The 15-minute interval balances responsiveness with resource efficiency

