const LEGACY_HOST = 'qocduqtfbsevnhlgsfka.supabase.co';

/** Validate names/relationships only. Never echo credential values into build logs. */
export function validateMigrationBuildEnv(env) {
  if (!env.VITE_SUPABASE_URL?.trim()) {
    throw new Error('Set VITE_SUPABASE_URL in Netlify with Builds scope for this deployment context, then rebuild.');
  }
  let url;
  try { url = new URL(env.VITE_SUPABASE_URL); }
  catch { throw new Error('VITE_SUPABASE_URL must be the new Supabase HTTPS project URL.'); }
  if (url.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) || url.hostname === LEGACY_HOST || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/') {
    throw new Error('VITE_SUPABASE_URL must be the new HTTPS project origin, not the old production backend.');
  }
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!key) throw new Error('Set VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) with Builds scope.');
  if (key.startsWith('sb_secret_')) throw new Error('A secret key must never be put in a VITE_ variable. Use a publishable/anon key.');
  if (key.split('.').length === 3) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')); }
    catch { throw new Error('The configured public JWT key is malformed.'); }
    if (payload.role !== 'anon') throw new Error('VITE_ Supabase keys must have the anon role; service_role keys are server-only.');
    if (payload.ref && `${payload.ref}.supabase.co` !== url.hostname) {
      throw new Error('The Supabase public JWT key and VITE_SUPABASE_URL belong to different projects.');
    }
  }
  if (env.VITE_SUPABASE_PROJECT_ID?.trim() &&
      url.hostname.endsWith('.supabase.co') &&
      url.hostname !== `${env.VITE_SUPABASE_PROJECT_ID.trim()}.supabase.co`) {
    throw new Error('VITE_SUPABASE_PROJECT_ID does not match VITE_SUPABASE_URL.');
  }
  for (const name of Object.keys(env)) {
    if (/^VITE_.*(SERVICE_ROLE|RESEND_API_KEY|BUNDLE_SOCIAL_API_KEY|SMTP_PASSWORD|SECRET_KEY)$/.test(name) && env[name]) {
      throw new Error(`Remove server credential ${name} from browser/build variables.`);
    }
  }
}
