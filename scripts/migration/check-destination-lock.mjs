import { validateMigrationBuildEnv } from './validate-env.mjs';

/** A read-only GET to our known status RPC; never invokes a sending/processing endpoint. */
export async function verifyDestinationLock(env, fetcher = globalThis.fetch) {
  validateMigrationBuildEnv(env);
  const locked = env.VITE_MIGRATION_OUTBOUND_DISABLED?.trim() !== 'false' ||
    env.VITE_MIGRATION_RELEASE_APPROVED?.trim() !== 'true';
  if (!locked) return;
  const base = new URL(env.VITE_SUPABASE_URL);
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY).trim();
  const headers = { apikey: key };
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;
  let response;
  try {
    response = await fetcher(`${base.origin}/rest/v1/rpc/migration_no_contact_status`, {
      method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Could not verify the destination database lock. Check connectivity and the new project URL/key; deployment remains blocked.');
  }
  if (!response.ok) {
    throw new Error('Destination no-contact lock is not available. Run scripts/migration/lock-destination.sql ONLY in the new project, then rebuild.');
  }
  let status;
  try { status = await response.json(); }
  catch { throw new Error('Destination lock returned an invalid response. Deployment remains blocked.'); }
  if (status?.database_locked !== true || status?.target_project_ref !== base.hostname.split('.')[0] ||
      ['active_cron_jobs','queued_http_requests','unguarded_network_routines','active_http_triggers','changed_quarantined_routines']
        .some(name => status[name] !== 0)) {
    throw new Error('Destination database no-contact checks failed. Keep the migration locked, rerun the SQL lock after reviewing changes, and inspect migration_no_contact_status().');
  }
}
