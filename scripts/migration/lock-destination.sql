-- RUN ONLY in the NEW migration Supabase project's SQL Editor as postgres.
-- This is an operational lock, NOT a historical schema migration or a production release.
-- It intentionally pauses ALL cron jobs, including maintenance jobs.
-- It does not delete business queues or rewrite user email addresses.
-- No already-dispatched request or already-sent email can be recalled by this script.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';
SELECT set_config('migration_safety.confirm_target', 'kwfqjnepesiihjkdnxou', true);

DO $check_target$
DECLARE ref text := current_setting('migration_safety.confirm_target');
BEGIN
  IF ref !~ '^[a-z0-9]{20}$' OR ref = 'qocduqtfbsevnhlgsfka' THEN
    RAISE EXCEPTION 'Edit confirm_target to the NEW project reference and verify the Dashboard project before running.';
  END IF;
END
$check_target$;

CREATE SCHEMA IF NOT EXISTS migration_safety;
REVOKE ALL ON SCHEMA migration_safety FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS migration_safety.state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  target_project_ref text NOT NULL,
  locked boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS migration_safety.function_backup (
  signature text PRIMARY KEY,
  function_oid oid NOT NULL,
  definition text NOT NULL,
  guard_body text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS migration_safety.trigger_backup (
  schema_name text NOT NULL,
  table_name text NOT NULL,
  trigger_name text NOT NULL,
  enabled_code "char" NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (schema_name, table_name, trigger_name)
);
CREATE TABLE IF NOT EXISTS migration_safety.cron_backup (
  jobid bigint PRIMARY KEY,
  job_data jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS migration_safety.http_queue_backup (
  request_id bigint PRIMARY KEY,
  request_data jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA migration_safety FROM PUBLIC, anon, authenticated, service_role;

DO $record_target$
BEGIN
  IF EXISTS (SELECT FROM migration_safety.state
             WHERE target_project_ref <> current_setting('migration_safety.confirm_target')) THEN
    RAISE EXCEPTION 'Existing lock belongs to a different declared project. Stop and check the selected project.';
  END IF;
  INSERT INTO migration_safety.state(singleton, target_project_ref)
  VALUES(true, current_setting('migration_safety.confirm_target'))
  ON CONFLICT(singleton) DO UPDATE SET locked = true, updated_at = now();
END
$record_target$;

CREATE OR REPLACE FUNCTION migration_safety.application_schema(name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $body$
  SELECT name !~ '^pg_' AND name NOT IN (
    'information_schema','net','cron','extensions','supabase_functions','auth','storage',
    'realtime','_realtime','vault','graphql','graphql_public','pgsodium','pgsodium_masks',
    'supabase_migrations','migration_safety'
  );
$body$;

CREATE OR REPLACE FUNCTION migration_safety.network_body(source text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $body$
  SELECT replace(source, '"', '') ~* (
    '\mnet\s*\.\s*http_|\mextensions\s*\.\s*http|' ||
    '\msupabase_functions\s*\.\s*http_request|' ||
    '\mhttp(_(get|post|put|patch|delete|head))?\s*\(|\mdblink(_exec|_connect)?\s*\('
  );
$body$;

-- First stop periodic producers. Preserve their original states, schedules and commands privately.
DO $pause_cron$
DECLARE job record;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR job IN EXECUTE 'SELECT jobid, to_jsonb(j) AS data FROM cron.job AS j' LOOP
      INSERT INTO migration_safety.cron_backup(jobid, job_data)
      VALUES(job.jobid, job.data) ON CONFLICT DO NOTHING;
      PERFORM cron.alter_job(job_id := job.jobid, active := false);
    END LOOP;
  END IF;
END
$pause_cron$;

-- Disable direct HTTP/database-link triggers, including Database Webhooks.
-- Triggers calling an application dispatcher indirectly are blocked by the dispatcher stubs below.
DO $pause_triggers$
DECLARE item record;
BEGIN
  FOR item IN
    SELECT n.nspname, c.relname, t.tgname, t.tgenabled
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE NOT t.tgisinternal
      AND (migration_safety.application_schema(n.nspname) OR n.nspname IN ('auth','storage'))
      AND ((pn.nspname = 'supabase_functions' AND p.proname = 'http_request')
           OR migration_safety.network_body(p.prosrc))
  LOOP
    INSERT INTO migration_safety.trigger_backup(schema_name,table_name,trigger_name,enabled_code)
    VALUES(item.nspname,item.relname,item.tgname,item.tgenabled) ON CONFLICT DO NOTHING;
    EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I',item.nspname,item.relname,item.tgname);
  END LOOP;
END
$pause_triggers$;

-- Neutralize direct networking routines rather than relying on role REVOKEs alone:
-- SECURITY DEFINER callers can otherwise retain their owners' ability to dispatch HTTP.
-- Original definitions are private backups; managed net/auth/storage functions are not replaced.
DO $block_dispatchers$
DECLARE item record;
DECLARE identity text;
DECLARE guard text := 'BEGIN RAISE EXCEPTION USING MESSAGE = ''MIGRATION_OUTBOUND_BLOCKED: database dispatcher is quarantined'', ERRCODE = ''55000''; END;';
BEGIN
  FOR item IN
    SELECT p.oid, p.proname, p.prokind, n.nspname,
           pg_get_function_arguments(p.oid) AS args,
           CASE WHEN p.prokind = 'f' THEN pg_get_function_result(p.oid) END AS result,
           oidvectortypes(p.proargtypes) AS identity_args,
           pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prokind IN ('f','p') AND migration_safety.application_schema(n.nspname)
      AND migration_safety.network_body(p.prosrc)
  LOOP
    identity := format('%I.%I(%s)',item.nspname,item.proname,item.identity_args);
    INSERT INTO migration_safety.function_backup(signature,function_oid,definition,guard_body)
    VALUES(identity,item.oid,item.definition,guard) ON CONFLICT DO NOTHING;
    IF item.prokind = 'p' THEN
      EXECUTE format('CREATE OR REPLACE PROCEDURE %I.%I(%s) LANGUAGE plpgsql SECURITY INVOKER AS %L',
                     item.nspname,item.proname,item.args,guard);
    ELSE
      EXECUTE format('CREATE OR REPLACE FUNCTION %I.%I(%s) RETURNS %s LANGUAGE plpgsql SECURITY INVOKER AS %L',
                     item.nspname,item.proname,item.args,item.result,guard);
    END IF;
  END LOOP;
END
$block_dispatchers$;

-- Quarantine pending pg_net requests, including any copied credentials in their headers.
-- ACCESS EXCLUSIVE prevents the worker taking another queued row while this transaction holds it.
DO $quarantine_http$
BEGIN
  IF to_regclass('net.http_request_queue') IS NOT NULL THEN
    LOCK TABLE net.http_request_queue IN ACCESS EXCLUSIVE MODE;
    INSERT INTO migration_safety.http_queue_backup(request_id,request_data)
    SELECT id,to_jsonb(q) FROM net.http_request_queue q ON CONFLICT DO NOTHING;
    DELETE FROM net.http_request_queue;
  END IF;
END
$quarantine_http$;

CREATE OR REPLACE FUNCTION migration_safety.status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $body$
DECLARE active_jobs bigint := 0;
DECLARE queued_http bigint := 0;
DECLARE unguarded_routines bigint;
DECLARE active_http_triggers bigint;
DECLARE changed_guards bigint;
DECLARE ref text;
DECLARE is_locked boolean;
BEGIN
  SELECT target_project_ref,locked INTO ref,is_locked FROM migration_safety.state WHERE singleton;
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM cron.job WHERE active' INTO active_jobs;
  END IF;
  IF to_regclass('net.http_request_queue') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM net.http_request_queue' INTO queued_http;
  END IF;
  SELECT count(*) INTO unguarded_routines
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind IN ('f','p') AND migration_safety.application_schema(n.nspname)
    AND migration_safety.network_body(p.prosrc);
  SELECT count(*) INTO changed_guards FROM migration_safety.function_backup b
  JOIN pg_proc p ON p.oid = b.function_oid WHERE p.prosrc <> b.guard_body;
  SELECT count(*) INTO active_http_triggers
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace pn ON pn.oid = p.pronamespace
  WHERE NOT t.tgisinternal AND t.tgenabled <> 'D'
    AND (migration_safety.application_schema(n.nspname) OR n.nspname IN ('auth','storage'))
    AND ((pn.nspname = 'supabase_functions' AND p.proname = 'http_request') OR migration_safety.network_body(p.prosrc));
  RETURN jsonb_build_object(
    'target_project_ref',ref,
    'database_locked',coalesce(is_locked,false) AND active_jobs=0 AND queued_http=0
                      AND unguarded_routines=0 AND active_http_triggers=0 AND changed_guards=0,
    'active_cron_jobs',active_jobs,'queued_http_requests',queued_http,
    'unguarded_network_routines',unguarded_routines,'active_http_triggers',active_http_triggers,
    'changed_quarantined_routines',changed_guards,
    'quarantined_routines',(SELECT count(*) FROM migration_safety.function_backup)
  );
END
$body$;

-- Expose only a boolean/count summary for the build check, never definitions, recipients or credentials.
CREATE OR REPLACE FUNCTION public.migration_no_contact_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $body$
  SELECT migration_safety.status();
$body$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA migration_safety FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.migration_no_contact_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migration_no_contact_status() TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT public.migration_no_contact_status();
