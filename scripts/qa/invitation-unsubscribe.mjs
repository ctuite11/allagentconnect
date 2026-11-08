// Offline behavioral checks: no network, database, queue or provider access.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
const root = 'supabase/functions/';
function source(path) {
  return stripTypeScriptTypes(readFileSync(root + path, 'utf8')
    .replace(/import[\s\S]*?from\s*["'][^"']+["'];/g, '')
    .replace(/export /g, ''), { mode: 'transform' });
}
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
let handler, writes = [], dbError = null;
const Deno = { env: { get: () => 'offline' }, serve: h => { handler = h; } };
const createClient = () => ({ from: () => ({ upsert: async row => { writes.push(row); return { error: dbError }; } }) });
await new AsyncFunction('Deno', 'createClient', 'b64urlDecode', 'verifyUnsub', source('email-unsubscribe/index.ts'))(
  Deno, createClient, x => Buffer.from(x, 'base64url').toString(), async (_e, _c, t) => t === 'valid');
const url = 'https://offline.test/?e=' + Buffer.from('fixture@example.test').toString('base64url') + '&c=marketing&t=valid';
for (const method of ['GET', 'POST', 'GET']) {
  const response = await handler(new Request(url, { method }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/plain/);
  assert.doesNotMatch(await response.text(), /<[^>]+>|communications\?prefs/);
}
assert.equal(writes.length, 3);
for (const [target, method, status] of [[url.replace('valid', 'bad'), 'GET', 400], ['https://offline.test/', 'GET', 400], [url, 'PUT', 405]]) {
  const before = writes.length;
  assert.equal((await handler(new Request(target, { method }))).status, status);
  assert.equal(writes.length, before);
}
dbError = { message: 'simulated database failure' };
assert.equal((await handler(new Request(url))).status, 500);
let providerCalls = 0, lookup = { data: true, error: null };
const senderClient = () => ({ rpc: async () => lookup });
const { sendEmail, injectOptOutFooter } = await new AsyncFunction('Deno', 'createClient', 'buildTransactionalFrom', 'isSubscriptionCategory', 'buildUnsubUrl', 'buildListUnsubscribeHeaders', 'unsubscribeCategoryLabel', 'MANAGE_EMAIL_PREFERENCES_URL', 'isMarketingCategory', 'fetch', source('_shared/sendEmail.ts') + '\nreturn { sendEmail, injectOptOutFooter };')(
 Deno, senderClient, () => 'AAC <hello@example.test>', c => c === 'marketing', async () => url, () => ({}), () => 'marketing emails', 'https://offline.test/communications?prefs=1', () => false,
 async () => { providerCalls++; throw new Error('Provider must never be called'); });
const job = { id: 'offline', payload: { to: 'fixture@example.test', category: 'marketing', template: 'founder-invite-1to1', html: '<body>Fixture</body>' } };
await sendEmail(job, 'not-a-key');
await sendEmail({ ...job, payload: { ...job.payload, category: undefined } }, 'not-a-key');
await assert.rejects(sendEmail({ ...job, payload: { ...job.payload, to: ['a@example.test', 'b@example.test'] } }, 'not-a-key'), /one recipient/);
for (const result of [{ data: null, error: { message: 'offline' } }, { data: null, error: null }]) {
 lookup = result;
 await assert.rejects(sendEmail(job, 'not-a-key'), /suppression check unavailable/);
}
assert.equal(providerCalls, 0);
const footer = injectOptOutFooter('<body>Fixture</body>', { unsubscribeUrl: url, recipientEmail: 'fixture@example.test', category: 'marketing' });
assert.match(footer, /Unsubscribe from marketing emails/);
assert.doesNotMatch(footer, /Manage email preferences/);
console.log('PASS: GET/POST, repeat, invalid/tampered link, method restriction, DB failure, readable responses, marketing footer, suppression and lookup failures; zero provider calls.');
