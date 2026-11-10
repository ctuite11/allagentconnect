import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import * as privatePreview from '../../supabase/functions/_shared/privatePreview.ts';
import * as privacyRoutes from '../../supabase/functions/_shared/privacyRoutes.ts';
import {
  migrationOutboundLocked, assertMigrationDeliveryAllowed, createMigrationFetch,
  assertMigrationRequestAllowed, LEGACY_BACKEND_HOST,
} from '../../supabase/functions/_shared/migrationSafety.ts';
import { validateMigrationBuildEnv } from './validate-env.mjs';
import { verifyDestinationLock } from './check-destination-lock.mjs';

const root = resolve(import.meta.dirname, '../..');
const ref = 'zzzzzzzzzzzzzzzzzzzz';
const origin = `https://${ref}.supabase.co`;
const base = { SUPABASE_URL: origin };
const env = (values = {}) => name => ({ ...base, ...values })[name];
const release = { MIGRATION_OUTBOUND_DISABLED: 'false', MIGRATION_RELEASE_APPROVED: 'true' };
const buildEnv = { VITE_SUPABASE_URL: origin, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_offline_fixture' };
const lockedStatus = {
  target_project_ref: ref, database_locked: true, active_cron_jobs: 0,
  queued_http_requests: 0, unguarded_network_routines: 0,
  active_http_triggers: 0, changed_quarantined_routines: 0,
};

test('missing, partial and misspelled release flags stay locked', () => {
  for (const flags of [{}, { MIGRATION_OUTBOUND_DISABLED: 'false' },
    { MIGRATION_RELEASE_APPROVED: 'true' }, { ...release, MIGRATION_RELEASE_APPROVED: 'TRUE' },
    { ...release, MIGRATION_OUTBOUND_DISABLED: '0' }]) {
    assert.equal(migrationOutboundLocked(env(flags)), true);
    assert.throws(() => assertMigrationDeliveryAllowed(env(flags)), /MIGRATION_OUTBOUND_BLOCKED/);
  }
  assert.equal(migrationOutboundLocked(env(release)), false);
  assert.doesNotThrow(() => assertMigrationDeliveryAllowed(env(release)));
});

for (const [label, url, init] of [
  ['Resend HTTP', 'https://api.resend.com/emails', { method: 'POST', body: 'fixture' }],
  ['social publishing', 'https://api.bundle.social/api/v1/post', { method: 'POST' }],
  ['unknown webhook', 'https://hooks.example.invalid/customer', { method: 'POST' }],
  ['unknown GET webhook', 'https://hooks.example.invalid/send', {}],
  ['old worker', `https://${LEGACY_BACKEND_HOST}/functions/v1/process-email-queue`, { method: 'POST' }],
  ['old static assets', `https://${LEGACY_BACKEND_HOST}/storage/v1/object/public/x/y`, {}],
  ['foreign project', 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co/rest/v1/users', {}],
  ['hostname suffix attack', `${origin}.evil.invalid/rest/v1/users`, {}],
  ['HTTP transport', origin.replace('https:', 'http:') + '/rest/v1/users', {}],
  ['URL credentials', origin.replace('https://', 'https://name:secret@') + '/rest/v1/users', {}],
  ['Auth invite', `${origin}/auth/v1/invite`, { method: 'POST' }],
  ['Auth recovery', `${origin}/auth/v1/recover`, { method: 'POST' }],
  ['Auth signup', `${origin}/auth/v1/signup`, { method: 'POST' }],
  ['Auth OTP', `${origin}/auth/v1/otp`, { method: 'POST' }],
  ['Auth resend', `${origin}/auth/v1/resend`, { method: 'POST' }],
  ['Auth email/password change', `${origin}/auth/v1/user`, { method: 'PUT' }],
  ['Auth encoded prefix', `${origin}/auth%2fv1/recover`, { method: 'POST' }],
  ['Auth encoded token action', `${origin}/auth/v1/token%2f..%2frecover`, { method: 'POST' }],
  ['provider write', 'https://api.repliers.io/listings', { method: 'POST' }],
]) {
  test(`locked request never reaches transport: ${label}`, async () => {
    let calls = 0;
    const guarded = createMigrationFetch(async () => { calls++; return new Response('bad'); }, env());
    await assert.rejects(guarded(url, init), /MIGRATION_OUTBOUND_BLOCKED/);
    assert.equal(calls, 0);
  });
}

test('SMTP delivery assertion rejects before a transporter can be opened', () => {
  let socketsOpened = 0;
  assert.throws(() => { assertMigrationDeliveryAllowed(env()); socketsOpened++; }, /MIGRATION_OUTBOUND_BLOCKED/);
  assert.equal(socketsOpened, 0);
  const smtp = readFileSync(resolve(root, 'supabase/functions/send-listing-share/index.ts'), 'utf8');
  assert.match(smtp, /assertMigrationDeliveryAllowed\(\);\s*const transporter = nodemailer\.createTransport/);
});

test('pause also blocks delivery after explicit migration release', async () => {
  const paused = env({ ...release, EMAIL_SENDING_PAUSED: 'true' });
  assert.throws(() => assertMigrationDeliveryAllowed(paused), /MIGRATION_OUTBOUND_BLOCKED/);
  assert.throws(() => assertMigrationRequestAllowed('https://api.resend.com/emails', { method: 'POST' }, paused), /MIGRATION_OUTBOUND_BLOCKED/);
});

for (const [path, method] of [
  ['/rest/v1/listings', 'GET'], ['/rest/v1/rpc/publish_listing', 'POST'],
  ['/storage/v1/object/authenticated/documents/example.pdf', 'GET'],
  ['/functions/v1/process-email-queue', 'POST'], ['/auth/v1/user', 'GET'],
  ['/auth/v1/token?grant_type=password', 'POST'], ['/auth/v1/token?grant_type=refresh_token', 'POST'],
  ['/auth/v1/logout', 'POST'],
]) {
  test(`destination operation remains possible: ${method} ${path}`, async () => {
    let calls = 0;
    const guarded = createMigrationFetch(async (_request, init) => {
      calls++; assert.equal(init.redirect, 'error'); return new Response('fixture');
    }, env());
    assert.equal(await (await guarded(origin + path, { method })).text(), 'fixture');
    assert.equal(calls, 1);
  });
}

test('read-only integration calls allowed; their redirects cannot bypass the guard', async () => {
  for (const url of ['https://api.repliers.io/listings?resultsPerPage=1',
    'https://maps.googleapis.com/maps/api/geocode/json?address=fixture',
    'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail']) {
    const guarded = createMigrationFetch(async (_request, init) => {
      assert.equal(init.redirect, 'error'); return new Response('fixture');
    }, env());
    await guarded(url, { redirect: 'follow' });
  }
});

test('Request objects preserve method checks; init method overrides are checked', () => {
  const req = new Request(`${origin}/auth/v1/user`, { method: 'GET' });
  assert.doesNotThrow(() => assertMigrationRequestAllowed(req, undefined, env()));
  assert.throws(() => assertMigrationRequestAllowed(req, { method: 'PUT' }, env()), /MIGRATION_OUTBOUND_BLOCKED/);
});

test('legacy project remains blocked after release, including trailing-dot hostname', () => {
  for (const host of [LEGACY_BACKEND_HOST, LEGACY_BACKEND_HOST + '.']) {
    assert.throws(() => assertMigrationRequestAllowed(`https://${host}/functions/v1/send`, {}, env(release)), /legacy production/);
  }
});

test('errors omit tokens, query strings, bodies and recipients', () => {
  try { assertMigrationRequestAllowed('https://evil.invalid/send?token=hidden-value&to=user@example.invalid', { method: 'POST', body: 'hidden-body' }, env()); }
  catch (error) { assert.doesNotMatch(error.message, /hidden|user@example|\?token/); return; }
  assert.fail('request was not blocked');
});

test('all 123 Supabase Edge and Netlify serverless entrypoints install the guard first', () => {
  let entries = 0;
  for (const dir of readdirSync(resolve(root, 'supabase/functions'), { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === '_shared') continue;
    const path = resolve(root, 'supabase/functions', dir.name, 'index.ts');
    let source; try { source = readFileSync(path, 'utf8'); } catch { continue; }
    assert.ok(source.startsWith('import "../_shared/migrationRuntime.ts";'), path);
    entries++;
  }
  assert.equal(entries, 123);
  const folder = 'netlify/functions';
  for (const name of readdirSync(resolve(root, folder)).filter(name => name.endsWith('.ts'))) {
    assert.ok(readFileSync(resolve(root, folder, name), 'utf8')
      .startsWith('import "../../supabase/functions/_shared/migrationRuntime.ts";'), `${folder}/${name}`);
  }
});

test('Netlify Edge entrypoints preserve platform fetch and scope application requests', () => {
  const folder = 'netlify/edge-functions';
  for (const name of readdirSync(resolve(root, folder)).filter(name => name.endsWith('.ts'))) {
    const source = readFileSync(resolve(root, folder, name), 'utf8');
    assert.doesNotMatch(source, /migrationRuntime|installMigrationFetchGuard|globalThis\.fetch\s*=/, `${folder}/${name}`);
    assert.doesNotMatch(source, /\bfetch\s*\(/, `use scoped migrationFetch for application requests in ${name}`);
  }
});

test('queue entrypoints gate before claiming work', () => {
  for (const name of ['process-email-queue', 'kick-email-queue', 'send-single-email-job']) {
    const source = readFileSync(resolve(root, `supabase/functions/${name}/index.ts`), 'utf8');
    assert.match(source, /if \(migrationOutboundLocked\(\) \|\| isGloballyPaused\(\)\)/);
    assert.ok(source.indexOf('if (migrationOutboundLocked()') < source.indexOf('await supabase.rpc(') ||
      !source.includes('await supabase.rpc('));
  }
});

test('missing URL/key and old URL fail build with actionable errors', () => {
  assert.throws(() => validateMigrationBuildEnv({}), /VITE_SUPABASE_URL/);
  assert.throws(() => validateMigrationBuildEnv({ VITE_SUPABASE_URL: origin }), /PUBLISHABLE_KEY/);
  assert.throws(() => validateMigrationBuildEnv({ ...buildEnv, VITE_SUPABASE_URL: `https://${LEGACY_BACKEND_HOST}` }), /old production/);
  assert.doesNotThrow(() => validateMigrationBuildEnv(buildEnv));
  assert.doesNotThrow(() => validateMigrationBuildEnv({ VITE_SUPABASE_URL: origin, VITE_SUPABASE_ANON_KEY: 'sb_publishable_fixture' }));
});

test('build rejects browser secret keys, service-role JWTs and wrong-project JWTs', () => {
  const jwt = payload => `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.fixture`;
  for (const key of ['sb_secret_fixture', jwt({ role: 'service_role', ref }), jwt({ role: 'anon', ref: 'other-project' })]) {
    assert.throws(() => validateMigrationBuildEnv({ ...buildEnv, VITE_SUPABASE_PUBLISHABLE_KEY: key }));
  }
  assert.doesNotThrow(() => validateMigrationBuildEnv({ ...buildEnv, VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'anon', ref }) }));
});

test('build status probe is read-only, exact-project and carries no secret credentials', async () => {
  await verifyDestinationLock(buildEnv, async (url, init) => {
    assert.equal(url, `${origin}/rest/v1/rpc/migration_no_contact_status`);
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
    assert.equal(init.headers.apikey, buildEnv.VITE_SUPABASE_PUBLISHABLE_KEY);
    assert.equal(init.headers.Authorization, undefined);
    return Response.json(lockedStatus);
  });
});

test('build is blocked on absent/unreachable/unsafe/mismatched database lock', async () => {
  for (const value of [
    null, { ...lockedStatus, database_locked: false }, { ...lockedStatus, active_cron_jobs: 1 },
    { ...lockedStatus, queued_http_requests: 1 }, { ...lockedStatus, active_http_triggers: 1 },
    { ...lockedStatus, changed_quarantined_routines: 1 }, { ...lockedStatus, unguarded_network_routines: 1 },
    { ...lockedStatus, target_project_ref: 'other-project' },
  ]) {
    await assert.rejects(verifyDestinationLock(buildEnv, async () => Response.json(value)), /checks failed/);
  }
  await assert.rejects(verifyDestinationLock(buildEnv, async () => new Response('', { status: 404 })), /Run scripts/);
  await assert.rejects(verifyDestinationLock(buildEnv, async () => { throw new Error('offline'); }), /remains blocked/);
});

// Netlify's context.next() uses the runtime's global fetch to reach its own CDN.
// Execute every Edge entrypoint in one isolated runtime with the real guard;
// ignoring migrationRuntime imports would conceal the original passthrough crash.
function netlifyEdgeRuntime(values = {}, transport) {
  const calls = [];
  const readEnv = name => values[name];
  const nativeFetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, init });
    if (transport) return transport(url, init);
    if (url.includes('/rest/v1/rpc/rate_limit_consume')) {
      return Response.json({ allowed: true, remaining: 2, reset_at: '2099-01-01T00:00:00Z', current_count: 1 });
    }
    if (url.includes('/auth/v1/admin/generate_link')) {
      return Response.json({ properties: { action_link: 'https://fixture.invalid/reset' } });
    }
    return new Response(readFileSync(resolve(root, 'index.html'), 'utf8'), {
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=60' },
    });
  };
  const runtime = createContext({
    Request, Response, Headers, URL, fetch: nativeFetch,
    Netlify: { env: { get: readEnv } }, process: { env: {} },
    console: { log() {}, warn() {}, error() {} },
  });
  let installed = false;
  runtime.__edgeImports = {
    '../../supabase/functions/_shared/migrationRuntime.ts': {
      install() {
        if (installed) return;
        installed = true;
        runtime.fetch = createMigrationFetch(runtime.fetch, readEnv);
      },
    },
    '../../supabase/functions/_shared/migrationSafety.ts': {
      createMigrationFetch: original => createMigrationFetch(original, readEnv),
    },
    '../../supabase/functions/_shared/privatePreview.ts': privatePreview,
    '../../supabase/functions/_shared/privacyRoutes.ts': privacyRoutes,
    'https://esm.sh/v135/@supabase/supabase-js@2.42.3?target=denonext': {
      createClient(url, _key, options) {
        assert.equal(typeof options?.global?.fetch, 'function', 'the SDK must use the scoped guard');
        return { rpc: async (name, body) => {
          const response = await options.global.fetch(`${url}/rest/v1/rpc/${name}`, {
            method: 'POST', body: JSON.stringify(body),
          });
          return { data: await response.json(), error: null };
        } };
      },
    },
  };
  const handlers = {};
  for (const name of readdirSync(resolve(root, 'netlify/edge-functions')).filter(name => name.endsWith('.ts'))) {
    const path = resolve(root, 'netlify/edge-functions', name);
    const source = readFileSync(path, 'utf8')
      .replace(/^import\s+(?:\{([^}]+)\}\s+from\s+)?["']([^"']+)["'];[ \t]*$/gm, (_match, bindings, specifier) => {
        assert.ok(Object.hasOwn(runtime.__edgeImports, specifier), `unhandled Edge import: ${specifier}`);
        const dependency = `__edgeImports[${JSON.stringify(specifier)}]`;
        return bindings ? `const {${bindings}} = ${dependency};` : `${dependency}.install();`;
      })
      .replace(/export default /g, '')
      .replace(/export (?=(?:async )?(?:function|const))/g, '');
    handlers[name.slice(0, -3)] = runInContext(
      `(() => { ${stripTypeScriptTypes(source)}; return handler; })()`, runtime,
      { filename: path, timeout: 2000 },
    );
  }
  return { handlers, calls, runtime, nativeFetch,
    passthrough: host => ({ next: () => runtime.fetch(`https://${host}/fixture/index.html`) }),
  };
}

for (const host of ['cdn-reg-aws-iad-71.netliedge.com', 'cdn-reg-aws-fra-66.netliedge.com']) {
  test(`Netlify private-page passthrough reaches the platform CDN: ${host}`, async () => {
    const edge = netlifyEdgeRuntime(base);
    const request = new Request('https://aac.invalid/property/private-fixture', { headers: { 'User-Agent': 'Browser' } });
    const response = await edge.handlers['privacy-headers'](request, {
      next: () => edge.handlers['social-preview'](request, edge.passthrough(host)),
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<html/i);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('Netlify-CDN-Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
    assert.equal(edge.runtime.fetch, edge.nativeFetch, 'Edge modules must leave platform fetch untouched');
    assert.equal(edge.calls.length, 1);
    // Only the platform gets native fetch. Application calls to that host stay blocked.
    await assert.rejects(createMigrationFetch(edge.nativeFetch, env())(`https://${host}/send`), /MIGRATION_OUTBOUND_BLOCKED/);
    assert.equal(edge.calls.length, 1);
  });
}

test('Netlify public SEO and static-asset passthrough work without backend credentials', async () => {
  const edge = netlifyEdgeRuntime();
  const request = new Request('https://aac.invalid/about');
  const context = edge.passthrough('cdn-reg-aws-iad-71.netliedge.com');
  const response = await edge.handlers['privacy-headers'](request, {
    next: () => edge.handlers['public-page-seo'](request, context),
  });
  assert.equal(response.headers.get('X-Robots-Tag'), 'index, follow');
  const html = await response.text();
  assert.match(html, /<title>About All Agent Connect \| Founder Chris Tuite<\/title>/);
  assert.match(html, /https:\/\/allagentconnect\.com\/about/);
  const asset = await edge.handlers['privacy-headers'](new Request('https://aac.invalid/assets/fixture.js'), context);
  assert.equal(asset.headers.get('Cache-Control'), 'public, max-age=60');
});

test('Netlify crawler previews remain neutral without calling the CDN or backend', async () => {
  const edge = netlifyEdgeRuntime(base);
  const request = new Request('https://aac.invalid/property/private-fixture', { headers: { 'User-Agent': 'facebookexternalhit' } });
  const response = await edge.handlers['privacy-headers'](request, {
    next: () => edge.handlers['social-preview'](request, edge.passthrough('cdn-reg-aws-iad-71.netliedge.com')),
  });
  assert.equal(await response.text(), privatePreview.PRIVATE_PREVIEW_HTML);
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
  assert.equal(edge.calls.length, 0);
});

test('Netlify registration preview uses scoped destination checks and native fallback', async () => {
  const request = new Request('https://aac.invalid/register?listing_id=fixture', { headers: { 'User-Agent': 'facebookexternalhit' } });
  const edge = netlifyEdgeRuntime({ ...base, VITE_SUPABASE_URL: origin });
  assert.equal((await edge.handlers['register-social-preview'](request, edge.passthrough('cdn-reg-aws-iad-71.netliedge.com'))).status, 200);
  assert.equal(edge.calls[0].url, `${origin}/functions/v1/social-preview/property/fixture`);
  assert.equal(edge.calls[0].init.redirect, 'error');
  assert.equal(edge.runtime.fetch, edge.nativeFetch);
  for (const values of [
    {}, { ...base, VITE_SUPABASE_URL: `https://${LEGACY_BACKEND_HOST}` },
    { ...base, VITE_SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co' },
  ]) {
    const fallback = netlifyEdgeRuntime(values);
    const response = await fallback.handlers['register-social-preview'](request, fallback.passthrough('cdn-reg-aws-fra-66.netliedge.com'));
    assert.equal(response.status, 200);
    assert.deepEqual(fallback.calls.map(call => call.url), ['https://cdn-reg-aws-fra-66.netliedge.com/fixture/index.html']);
  }
});

const resetEnv = { ...base, SUPABASE_ANON_KEY: 'offline-anon', SUPABASE_SERVICE_ROLE_KEY: 'offline-service', RESEND_API_KEY: 'offline-resend' };
const resetRequest = () => new Request('https://aac.invalid/api/auth/request-password-reset', {
  method: 'POST', body: JSON.stringify({ email: 'fixture@example.invalid' }),
});

test('Netlify password reset keeps SDK rate limiting guarded and blocks delivery during migration', async () => {
  const edge = netlifyEdgeRuntime(resetEnv);
  const response = await edge.handlers['request-password-reset'](resetRequest(), { ip: '192.0.2.1' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.deepEqual(edge.calls.map(call => call.url), [`${origin}/rest/v1/rpc/rate_limit_consume`]);
  assert.equal(edge.calls[0].init.redirect, 'error');
  assert.equal(edge.runtime.fetch, edge.nativeFetch);
});

test('Netlify password reset retains the email pause after migration release', async () => {
  for (const paused of [true, false]) {
    const edge = netlifyEdgeRuntime({ ...resetEnv, ...release, EMAIL_SENDING_PAUSED: String(paused) });
    const response = await edge.handlers['request-password-reset'](resetRequest(), { ip: '192.0.2.1' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.deepEqual(edge.calls.map(call => call.url), [
      `${origin}/rest/v1/rpc/rate_limit_consume`, `${origin}/auth/v1/admin/generate_link`,
      ...(!paused ? ['https://api.resend.com/emails'] : []),
    ]);
    const recoveryBody = JSON.parse(edge.calls[1].init.body);
    assert.equal(recoveryBody.options.redirect_to, 'https://allagentconnect.com/auth/callback');
    assert.equal(edge.runtime.fetch, edge.nativeFetch);
  }
});

test('Netlify password reset still refuses rate-limited requests before recovery or delivery', async () => {
  const edge = netlifyEdgeRuntime(resetEnv, async () => Response.json({
    allowed: false, remaining: 0, reset_at: '2099-01-01T00:00:00Z', current_count: 4,
  }));
  const response = await edge.handlers['request-password-reset'](resetRequest(), { ip: '192.0.2.1' });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('X-RateLimit-Remaining'), '0');
  assert.deepEqual(edge.calls.map(call => call.url), [`${origin}/rest/v1/rpc/rate_limit_consume`]);
});
