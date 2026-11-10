import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
import { z } from 'zod';

const base = new URL('../../', import.meta.url);
function load(path, imports = {}, env = {}, fetchImpl) {
  const source = readFileSync(new URL(path, base), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  let handler;
  const context = { module, exports: module.exports, Request, Response, Headers, URL, AbortSignal, crypto: webcrypto, TextEncoder,
    console: { log() {}, warn() {}, error() {} },
    Deno: { env: { get: name => env[name] }, serve: fn => { handler = fn; } },
    fetch: fetchImpl ?? (() => { throw new Error('Network forbidden in offline endpoint tests'); }),
    require: name => {
      if (name.endsWith('/migrationRuntime.ts')) return {};
      if (name.endsWith('/http/server.ts')) return { serve: fn => { handler = fn; } };
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error('Unmocked import: ' + name);
    },
  };
  vm.runInNewContext(code, context, { filename: path, timeout: 2000 });
  return { exports: module.exports, get handler() { return handler; } };
}
const project = 'https://kwfqjnepesiihjkdnxou.supabase.co';
const media = load('supabase/functions/_shared/privateListingMedia.ts').exports;
const preview = load('supabase/functions/_shared/privatePreview.ts').exports;

test('stored media references resolve only to approved local buckets and paths', () => {
  const cases = ['fake/one.png', { path: 'fake/one.png' }, { url: project + '/storage/v1/object/public/listing-photos/fake/one.png' },
    { publicUrl: 'https://qocduqtfbsevnhlgsfka.supabase.co/storage/v1/object/public/listing-photos/fake/one.png' }];
  for (const value of cases) assert.equal(media.privateStorageObject(value, 'listing-photos', project).path, 'fake/one.png');
  for (const value of ['../outside.png', 'fake/../outside.png', 'https://evil.invalid/storage/v1/object/public/listing-photos/x',
    'http://kwfqjnepesiihjkdnxou.supabase.co/storage/v1/object/public/listing-photos/x',
    'https://kwfqjnepesiihjkdnxou.supabase.co.evil.invalid/storage/v1/object/public/listing-photos/x',
    'https://user:password@kwfqjnepesiihjkdnxou.supabase.co/storage/v1/object/public/listing-photos/x']) {
    assert.equal(media.privateStorageObject(value, 'listing-photos', project), null);
  }
});

test('both public social endpoints are generic without any database or storage client', async () => {
  const html = load('supabase/functions/social-preview/index.ts', { '../_shared/privatePreview.ts': preview });
  const image = load('supabase/functions/listing-og-image/index.ts');
  for (const path of ['?id=private-id', '/property/private-id', '/s/expired-secret']) {
    const response = await html.handler(new Request('https://local.invalid' + path));
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(await response.text(), preview.PRIVATE_PREVIEW_HTML);
    const result = await image.handler(new Request('https://local.invalid' + path));
    assert.equal(result.status, 302);
    assert.equal(result.headers.get('Location'), 'https://allagentconnect.com/og/aac-og-2026-01-22.jpg');
  }
});

test('Netlify crawler previews are neutral and normal browsers continue to the guarded SPA', async () => {
  const edge = load('netlify/edge-functions/social-preview.ts', { '../../supabase/functions/_shared/privatePreview.ts': preview }).exports.default;
  const context = { next: async () => new Response('SPA') };
  assert.equal(await (await edge(new Request('https://local.invalid/property/private-id', { headers: { 'User-Agent': 'facebookexternalhit' } }), context)).text(), preview.PRIVATE_PREVIEW_HTML);
  assert.equal(await (await edge(new Request('https://local.invalid/property/private-id', { headers: { 'User-Agent': 'Browser' } }), context)).text(), 'SPA');
});

test('server indexing uses exact marketing paths and preserves static-asset caching', async () => {
  const routes = load('supabase/functions/_shared/privacyRoutes.ts').exports;
  const handler = load('netlify/edge-functions/privacy-headers.ts', { '../../supabase/functions/_shared/privacyRoutes.ts': routes }).exports.default;
  for (const path of ['/', '/about', '/privacy/']) {
    const response = await handler(new Request('https://local.invalid' + path), { next: async () => new Response('marketing') });
    assert.equal(response.headers.get('X-Robots-Tag'), 'index, follow');
  }
  for (const path of ['/s/private', '/property/private', '/agent/private', '/about/private', '/auth', '/unknown']) {
    const response = await handler(new Request('https://local.invalid' + path), { next: async () => new Response('SPA') });
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  }
  const response = await handler(new Request('https://local.invalid/assets/hashed.js'), { next: async () => new Response('asset', { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }) });
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
});

test('verified endpoint helper validates Auth and database permissions, not just JWT presence', async () => {
  for (const [user, verified, expected] of [[null, false, false], [{ id: 'fake-user' }, false, false], [{ id: 'fake-user' }, true, true]]) {
    const client = { auth: { getUser: async () => ({ data: { user }, error: null }) },
      rpc: async name => ({ data: name === 'privacy_network_access' ? verified : 'fake-owner', error: null }) };
    const auth = load('supabase/functions/_shared/privacyAuth.ts', { 'https://esm.sh/@supabase/supabase-js@2': { createClient: () => client } }, { SUPABASE_URL: project, SUPABASE_ANON_KEY: 'offline' }).exports;
    assert.equal(Boolean(await auth.verifiedPrivacyClient(new Request('https://local.invalid', { headers: { Authorization: 'Bearer fake-user-jwt' } }))), expected);
    assert.equal(await auth.verifiedPrivacyClient(new Request('https://local.invalid')), null);
  }
});

test('photo service signs only database-resolved paths and preserves missing-file indexes', async () => {
  const signed = [];
  const rpc = [];
  const admin = { rpc: async (name, args) => { rpc.push({ name, args }); return { data: {
    photos: [{ url: 'https://evil.invalid/x' }, { url: project + '/storage/v1/object/public/listing-photos/fake/one.png' }],
    floor_plans: [{ path: 'fake/plan.pdf' }],
  }, error: null }; }, storage: { from: bucket => ({ createSignedUrls: async (paths, ttl) => {
    signed.push({ bucket, paths, ttl }); return { data: paths.map(path => ({ signedUrl: `https://local.invalid/signed/${bucket}/${path}` })), error: null };
  } }) } };
  const endpoint = load('supabase/functions/shared-listing-photos/index.ts', {
    'https://esm.sh/@supabase/supabase-js@2': { createClient: () => admin }, '../_shared/privateListingMedia.ts': media,
  }, { SUPABASE_URL: project, SUPABASE_SERVICE_ROLE_KEY: 'offline-service' });
  const response = await endpoint.handler(new Request('https://local.invalid', { method: 'POST', body: JSON.stringify({ token: 'f'.repeat(64), listing_id: '00000000-0000-4000-8000-000000000001', paths: ['unrelated/secret.png'] }) }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  const body = await response.json();
  assert.equal(body.photos[0], null); assert.match(body.photos[1], /fake\/one.png/);
  assert.equal(signed.length, 2); assert.equal(signed[0].paths[0], 'fake/one.png');
  assert.equal(signed[0].ttl, 600);
  assert.equal('paths' in rpc[0].args, false);
  assert.equal(JSON.stringify(body).includes('f'.repeat(64)), false);
});

test('photo service rejects missing, invalid and unauthorized requests uniformly without signing', async () => {
  let signed = false;
  const client = { auth: { getUser: async () => ({ data: { user: null }, error: new Error('invalid') }) },
    rpc: async () => ({ data: null, error: null }), storage: { from: () => { signed = true; throw new Error('must not sign'); } } };
  const endpoint = load('supabase/functions/shared-listing-photos/index.ts', {
    'https://esm.sh/@supabase/supabase-js@2': { createClient: () => client }, '../_shared/privateListingMedia.ts': media,
  }, { SUPABASE_URL: project, SUPABASE_SERVICE_ROLE_KEY: 'offline-service', SUPABASE_ANON_KEY: 'offline' });
  for (const body of [{ token: 'f'.repeat(64), listing_id: '00000000-0000-4000-8000-000000000001' }, { listing_id: '00000000-0000-4000-8000-000000000001' }]) {
    const response = await endpoint.handler(new Request('https://local.invalid', { method: 'POST', body: JSON.stringify(body) }));
    assert.equal(response.status, 404); assert.deepEqual(await response.json(), { error: 'invalid_link' });
  }
  assert.equal((await endpoint.handler(new Request('https://local.invalid', { method: 'GET' }))).status, 405);
  assert.equal(signed, false);
});

test('public seller intake returns a rate-limited count, with no network rows or identity fields', async () => {
  const calls = [];
  let denied = false;
  const client = { rpc: async (name, args) => {
    calls.push({ name, args });
    return { data: name === 'rate_limit_consume' ? [{ allowed: !denied }] : 3, error: null };
  } };
  const endpoint = load('supabase/functions/agent-match-count/index.ts', {
    'https://esm.sh/@supabase/supabase-js@2': { createClient: () => client },
  }, { SUPABASE_URL: project, SUPABASE_SERVICE_ROLE_KEY: 'offline' });
  const body = { p_city: 'Testville', p_state: 'MA', p_property_type: 'condo', p_price: 500000, p_bedrooms: 2, p_bathrooms: 1, injected_agent_id: 'must-not-forward' };
  const request = () => new Request('https://local.invalid', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': 'spoofed, 192.0.2.1' } });
  const response = await endpoint.handler(request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { count: 3 });
  assert.equal(calls.filter(c => c.name === 'rate_limit_consume').length, 2);
  assert.equal('injected_agent_id' in calls.at(-1).args, false);
  denied = true; calls.length = 0;
  assert.equal((await endpoint.handler(request())).status, 429);
  assert.equal(calls.some(c => c.name === 'count_matching_agents'), false);
  body.p_price = -1;
  assert.equal((await endpoint.handler(request())).status, 400);
});

test('canonical Hot Sheet enqueue adds the privacy contract and suppresses unapproved external delivery', async () => {
  const privacy = load('supabase/functions/_shared/privacyEmail.ts').exports;
  const claim = load('supabase/functions/_shared/hotSheetDeliveryClaim.ts', { './privacyEmail.ts': privacy }).exports;
  let allowed = false;
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push({ name,args }); return { data: name === 'privacy_email_delivery_allowed' ? allowed : { result: 'enqueued' }, error: null }; } };
  const args = { listingId: 'fake-listing', hotSheetId: 'fake-sheet', status: 'active', audience: 'client', recipientKey: 'fake-client',
    payload: { to: 'buyer@example.invalid', template: 'new-match-notification' }, idempotencyKey: 'fake-key', paused: false };
  assert.equal((await claim.enqueueHotSheetDelivery(client,args)).result, 'privacy_blocked');
  assert.equal(calls.some(c => c.name === 'enqueue_hot_sheet_delivery'), false);
  assert.equal(claim.isSettled('privacy_blocked'), true);
  assert.equal(claim.countsAsQueued('privacy_blocked'), false);
  allowed = true;
  assert.equal((await claim.enqueueHotSheetDelivery(client,args)).result, 'enqueued');
  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).args.p_payload.privacy)), { version: 1, audience: 'external', listing_ids: ['fake-listing'], hot_sheet_id: 'fake-sheet' });
});

test('actual email sender rechecks queued listing permission immediately before any provider call', async () => {
  const privacy = load('supabase/functions/_shared/privacyEmail.ts').exports;
  let allowed = false;
  let sent = 0;
  const client = { rpc: async () => ({ data: allowed, error: null }) };
  const sender = load('supabase/functions/_shared/sendEmail.ts', {
    './migrationSafety.ts': { assertMigrationDeliveryAllowed() {} }, './privacyEmail.ts': privacy,
    './renderEmailTemplate.ts': { renderEmailTemplate: () => '<p>View securely</p>' },
    './transactionalSender.ts': { buildTransactionalFrom: () => 'AAC <test@example.invalid>' },
    './tracking.ts': {}, './emailCategories.ts': { isSubscriptionCategory: () => false },
    'https://esm.sh/@supabase/supabase-js@2.39.3': { createClient: () => client },
  }, { SUPABASE_URL: project, SUPABASE_SERVICE_ROLE_KEY: 'offline' }, async () => { sent++; return Response.json({ id: 'fake-provider' }); }).exports;
  const job = { id: 'fake-job', payload: { template: 'bulk-listing-share', to: 'buyer@example.invalid', subject: 'Secure share', variables: {}, privacy: { version: 1 } } };
  await assert.rejects(sender.sendEmail(job,'offline-provider-key'), /Privacy email blocked/);
  assert.equal(sent, 0);
  allowed = true;
  assert.equal((await sender.sendEmail(job,'offline-provider-key')).providerMessageId, 'fake-provider');
  assert.equal(sent, 1);
  delete job.payload.privacy;
  await assert.rejects(sender.sendEmail(job,'offline-provider-key'), /Privacy email blocked/);
  assert.equal(sent, 1);
});

test('buyer message mail preserves the authored message while stripping automatic private property details', async () => {
  const privacy = load('supabase/functions/_shared/privacyEmail.ts').exports;
  let rendered;
  const sender = load('supabase/functions/_shared/sendEmail.ts', {
    './migrationSafety.ts': { assertMigrationDeliveryAllowed() {} }, './privacyEmail.ts': privacy,
    './renderEmailTemplate.ts': { renderEmailTemplate: (_template,variables) => { rendered=variables; return `<p>${variables.message_body}</p>`; } },
    './transactionalSender.ts': { buildTransactionalFrom: () => 'AAC <test@example.invalid>' },
    './tracking.ts': {}, './emailCategories.ts': { isSubscriptionCategory: () => false },
    'https://esm.sh/@supabase/supabase-js@2.39.3': { createClient: () => ({ rpc: async () => ({ data: false, error: null }) }) },
  }, { SUPABASE_URL: project, SUPABASE_SERVICE_ROLE_KEY: 'offline' }, async (_url,init) => {
    const sent=JSON.parse(init.body);
    assert.equal(sent.html,'<p>Human-authored message</p>');
    assert.equal(JSON.stringify(sent).includes('PRIVATE-ADDRESS'),false);
    return Response.json({id:'fake-provider'});
  }).exports;
  await sender.sendEmail({ id:'fake-job', payload:{ template:'new-message-notification', to:'buyer@example.invalid', subject:'New message',
    html:'PRIVATE-ADDRESS old pre-rendered card', variables:{ message_body:'Human-authored message', cta_url:'/messages/fake', recipient_role:'agent',
      listing:{id:'fake-listing',address:'PRIVATE-ADDRESS'}, listing_address:'PRIVATE-ADDRESS' } } },'offline');
  assert.equal(rendered.listing,null); assert.equal(rendered.listing_address,null);
  assert.equal(rendered.cta_url,'/messages/fake');
});

test('actual property email cards use neutral images for every source and retain the scoped buyer link', () => {
  const photos = load('supabase/functions/_shared/listingPhotoUrl.ts').exports;
  const address = load('supabase/functions/_shared/listingShareEmailAddress.ts').exports;
  const cards = load('supabase/functions/_shared/listingEmailCard.ts', {
    './listingPhotoUrl.ts': photos, './listingShareEmailAddress.ts': address,
  }).exports;
  const secure='https://aac.example.invalid/s/fake-hot-sheet-token?kind=hotsheet&listing=fake';
  for (const photoUrl of [project+'/storage/v1/object/public/listing-photos/fake.png','https://external.invalid/private-photo.jpg','fake/path.png']) {
    const html=cards.renderHotSheetMatchListingEmailCard({id:'fake',address:'Authorized address',price:500000,photoUrl,
      listing_agent_name:'PRIVATE-OWNER-NAME',listing_agent_email:'private-owner@example.invalid'}, {baseUrl:'https://aac.example.invalid',listingUrl:secure});
    assert.equal(html.includes(photoUrl),false);
    assert.equal(html.includes('PRIVATE-OWNER-NAME'),false);
    assert.equal(html.includes('private-owner@example.invalid'),false);
    assert.equal(html.includes('/og/aac-og-2026-01-22.jpg'),true);
    assert.equal(html.includes('fake-hot-sheet-token?kind=hotsheet&amp;listing=fake'),true);
  }
  const internal=cards.renderAgentHotSheetListingEmailCard({id:'fake',listing_agent_name:'Internal Agent',listing_agent_email:'agent@example.invalid'}, {baseUrl:'https://aac.example.invalid'});
  assert.equal(internal.includes('Internal Agent'),true);
  assert.equal(internal.includes('agent@example.invalid'),true);
});

test('legacy sitemap endpoint returns only the exact public marketing allowlist, without a database client', async () => {
  const routes=load('supabase/functions/_shared/privacyRoutes.ts').exports;
  const endpoint=load('supabase/functions/sitemap/index.ts',{'../_shared/privacyRoutes.ts':routes});
  const response=await endpoint.handler(new Request('https://local.invalid/?listing=private-id'));
  const xml=await response.text();
  const urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
  assert.deepEqual(urls,[...routes.PUBLIC_MARKETING_PATHS].map(path=>'https://allagentconnect.com'+path));
  assert.equal(xml.includes('/property/'),false); assert.equal(xml.includes('/agent/'),false);
});

test('private property history and enrichment reject unsigned callers before privileged access', async () => {
  const gate={'../_shared/privacyAuth.ts':{verifiedPrivacyClient:async()=>null}};
  const forbid=()=>{throw new Error('No privileged database access permitted');};
  const endpoints=[
    load('supabase/functions/get-property-history/index.ts',{...gate,'https://esm.sh/@supabase/supabase-js@2':{createClient:forbid}}),
    load('supabase/functions/auto-fetch-property-data/index.ts',gate),
  ];
  for(const endpoint of endpoints) {
    const response=await endpoint.handler(new Request('https://local.invalid',{method:'POST',body:'not-even-parsed-without-authorization'}));
    assert.equal(response.status,403); assert.deepEqual(await response.json(),{error:'Not authorized'});
  }
});

const publicListingId='00000000-0000-4000-8000-000000000301';
const privateListingId='00000000-0000-4000-8000-000000000302';
const buyerSheetId='00000000-0000-4000-8000-000000000303';
const ownerId='00000000-0000-4000-8000-000000000304';
const bodyForInquiry={listingId:publicListingId,dcmls:true,senderName:'Fixture Buyer',senderEmail:'buyer@example.invalid',message:'Please tell me more.'};
const bodyForShowing={listingId:publicListingId,dcmls:true,requesterName:'Fixture Buyer',requesterEmail:'buyer@example.invalid',preferredDate:'2099-01-01',preferredTime:'10:00',message:'Please arrange a tour.'};
function inquiryEndpoint(name,{published=false,buyer=false,allowed=true}={}) {
  const calls=[]; const rows=[];
  const client={
    auth:{getUser:async()=>({data:{user:buyer?{id:'fixture-buyer'}:null},error:null})},
    rpc:async(name,args)=>{
      calls.push({name,args});
      if(name==='rate_limit_consume')return {data:[{allowed}],error:null};
      if(name==='get_dcmls_listing')return {data:published?[{id:publicListingId,address:'Published Fixture Home',city:'Testville',state:'MA'}]:[],error:null};
      if(name==='get_dcmls_listing_agent')return {data:published?{agent_id:ownerId,email:'listing-owner@example.invalid',first_name:'Listing',last_name:'Owner'}:null,error:null};
      if(name==='get_buyer_listing')return {data:buyer?{listing:{id:publicListingId,address:'Authorized Buyer Home',city:'Testville',state:'MA'},agent:{id:'sharing-agent',email:'sharing-agent@example.invalid',first_name:'Sharing',last_name:'Agent'}}:null,error:null};
      throw new Error('Unexpected RPC '+name);
    },
    from:table=>({insert:value=>{
      rows.push({table,value}); calls.push({name:'insert:'+table});
      if(table==='email_jobs')return {select:()=>({single:async()=>({data:{id:'fixture-job'},error:null})})};
      return Promise.resolve({data:null,error:null});
    }}),
  };
  const imports={'../_shared/privacyAuth.ts':{verifiedPrivacyClient:async()=>null},
    'https://esm.sh/@supabase/supabase-js@2.38.0':{createClient:()=>client},
    '../_shared/verifyTurnstile.ts':{verifyTurnstileToken:async()=>({ok:true}),TURNSTILE_GENERIC_ERROR:'Check failed'}};
  const endpoint=load(`supabase/functions/${name}/index.ts`,imports,{SUPABASE_URL:project,SUPABASE_SERVICE_ROLE_KEY:'offline',SUPABASE_ANON_KEY:'offline'},async()=>Response.json({paused:true}));
  return {endpoint,calls,rows};
}

test('listing inquiry and showing reject a private raw ID without saving or queuing anything',async()=>{
  for(const name of ['send-contact-email','send-showing-request-email']) {
    const {endpoint,calls,rows}=inquiryEndpoint(name);
    const body={...(name==='send-contact-email'?bodyForInquiry:bodyForShowing),listingId:privateListingId};
    const response=await endpoint.handler(new Request('https://local.invalid',{method:'POST',body:JSON.stringify(body)}));
    assert.equal(response.status,404); assert.equal(rows.length,0);
    assert.equal(calls.some(c=>c.name==='get_public_listing'||c.name==='get_public_listing_agent'),false);
  }
});

test('explicit DCMLS publication permits contact and tour requests with server-resolved recipients',async()=>{
  for(const name of ['send-contact-email','send-showing-request-email']) {
    const {endpoint,rows}=inquiryEndpoint(name,{published:true});
    const body={...(name==='send-contact-email'?bodyForInquiry:bodyForShowing),agentEmail:'attacker@example.invalid'};
    const response=await endpoint.handler(new Request('https://local.invalid',{method:'POST',body:JSON.stringify(body)}));
    assert.equal(response.status,200);
    const job=rows.find(row=>row.table==='email_jobs').value.payload;
    assert.equal(job.to,'listing-owner@example.invalid');
    assert.equal(JSON.stringify(job).includes('attacker@example.invalid'),false);
    assert.deepEqual(JSON.parse(JSON.stringify(job.privacy)),{version:1,audience:'agent',listing_ids:[publicListingId]});
    assert.ok(rows.some(row=>row.table===(name==='send-contact-email'?'agent_messages':'showing_requests')));
  }
});

test('a buyer showing is authorized before persistence and delivered to the actual sharing agent',async()=>{
  const {endpoint,calls,rows}=inquiryEndpoint('send-showing-request-email',{buyer:true});
  const body={...bodyForShowing,dcmls:false,hotSheetId:buyerSheetId,agentEmail:'listing-owner@example.invalid'};
  const response=await endpoint.handler(new Request('https://local.invalid',{method:'POST',headers:{Authorization:'Bearer fake-buyer-jwt'},body:JSON.stringify(body)}));
  assert.equal(response.status,200);
  const scope=calls.find(c=>c.name==='get_buyer_listing');
  assert.deepEqual(JSON.parse(JSON.stringify(scope.args)),{p_listing_id:publicListingId,p_hot_sheet_id:buyerSheetId});
  assert.ok(calls.indexOf(scope)<calls.findIndex(c=>c.name==='insert:showing_requests'));
  assert.equal(rows.find(row=>row.table==='email_jobs').value.payload.to,'sharing-agent@example.invalid');
  assert.equal(calls.some(c=>c.name==='get_dcmls_listing'||c.name==='get_public_listing_agent'),false);
});

test('platform support keeps a fixed destination and a separate non-listing email template',async()=>{
  const {endpoint,rows,calls}=inquiryEndpoint('send-contact-email');
  const response=await endpoint.handler(new Request('https://local.invalid',{method:'POST',body:JSON.stringify({...bodyForInquiry,purpose:'support',agentEmail:'attacker@example.invalid'})}));
  assert.equal(response.status,200);
  const job=rows.find(row=>row.table==='email_jobs').value.payload;
  assert.equal(job.to,'hello@allagentconnect.com'); assert.equal(job.template,'platform-support');
  assert.equal(calls.some(c=>c.name==='get_dcmls_listing'),false);
});

test('DCMLS photo access uses only its publication-checking service RPC',async()=>{
  const calls=[];
  let published=true;
  const admin={rpc:async(name,args)=>{calls.push({name,args});return {data:published?{photos:[{path:'fixture/photo.png'}],floor_plans:[]}:null,error:null};},
    storage:{from:()=>({createSignedUrls:async paths=>({data:paths.map(path=>({signedUrl:'https://local.invalid/signed/'+path})),error:null})})}};
  const endpoint=load('supabase/functions/shared-listing-photos/index.ts',{
    'https://esm.sh/@supabase/supabase-js@2':{createClient:()=>admin},'../_shared/privateListingMedia.ts':media,
  },{SUPABASE_URL:project,SUPABASE_SERVICE_ROLE_KEY:'offline'});
  const request=extra=>new Request('https://local.invalid',{method:'POST',body:JSON.stringify({listing_id:publicListingId,dcmls:true,...extra})});
  assert.equal((await endpoint.handler(request())).status,200);
  assert.equal(calls[0].name,'get_dcmls_listing_photo_paths');
  published=false; assert.equal((await endpoint.handler(request())).status,404);
  assert.equal((await endpoint.handler(request({token:'f'.repeat(64)}))).status,400);
  assert.equal((await endpoint.handler(request({hot_sheet_id:buyerSheetId}))).status,400);
});

test('public DCMLS comparisons include only agents with an authorized publication',async()=>{
  const calls=[]; let allowed=true;
  const client={rpc:async()=>({data:[{allowed}],error:null}),from:table=>{
    calls.push(table);
    const query={select:()=>query,eq:()=>query,contains:()=>query,in:()=>query,
      maybeSingle:async()=>({data:null,error:null}),then:resolve=>resolve({data:table==='dcmls_listings_public'?[{agent_id:ownerId}]
        :table==='agent_settings'?[{user_id:ownerId},{user_id:privateListingId}]
        :[{id:ownerId,first_name:'Published',last_name:'Agent'},{id:privateListingId,first_name:'Private',last_name:'Agent'}],error:null})};
    return query;
  }};
  const endpoint=load('supabase/functions/dcmls-compare-agents/index.ts',{
    '../_shared/privacyAuth.ts':{verifiedPrivacyClient:async()=>null},'npm:@supabase/supabase-js@2':{createClient:()=>client},
    'npm:@supabase/supabase-js@2/cors':{corsHeaders:{}},'npm:zod@3.23.8':{z},
    '../_shared/dcmlsIncentives.ts':{DCMLS_SETTINGS_COLUMNS:'user_id',eligibleForCompare:()=>true},
  },{SUPABASE_URL:project,SUPABASE_SERVICE_ROLE_KEY:'offline'});
  const request=extra=>new Request('https://local.invalid',{method:'POST',body:JSON.stringify({type:'buyer',zip:'00000',...extra})});
  const response=await endpoint.handler(request()); assert.equal(response.status,200);
  const result=await response.json(); assert.deepEqual(result.agents.map(agent=>agent.id),[ownerId]);
  assert.equal(calls.includes('listings'),false);
  assert.equal((await endpoint.handler(request({listing_id:privateListingId}))).status,404);
  allowed=false; assert.equal((await endpoint.handler(request())).status,429);
});

function profileContactFixture({signed=true,published=true,captcha=true,admin=false,recipient=true,limited=false,limiterError=false,paused=false}={}) {
  const rows=[];const keys=[];const calls=[];
  const client={rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='has_role')return {data:admin,error:null};
    if(name==='rate_limit_consume')return {data:{allowed:!limited,reset_at:new Date(Date.now()+60000).toISOString()},error:limiterError?new Error('limiter unavailable'):null};
    if(name==='get_dcmls_agent_profile')return {data:published?{email:'published-agent@example.invalid',first_name:'Publisher'}:null,error:null};
    throw new Error('Unexpected RPC '+name);
  },from:table=>{
    const query={select:()=>query,eq:(...args)=>{calls.push({name:'filter',args});return query;},maybeSingle:async()=>({data:recipient?{email:'actual-agent@example.invalid',first_name:'Actual'}:null,error:null}),
      insert:value=>{rows.push({table,value});return {select:()=>({single:async()=>({data:{id:'offline-job'},error:null})})};}};
    return query;
  }};
  const caller=signed?{client,userId:'fixture-sender',ownerId:ownerId}:null;
  const endpoint=load('supabase/functions/send-agent-profile-contact/index.ts',{
    '../_shared/privacyAuth.ts':{verifiedPrivacyClient:async()=>caller},
    '../_shared/migrationSafety.ts':{assertMigrationDeliveryAllowed(){if(paused)throw Object.assign(new Error('paused'),{code:'MIGRATION_OUTBOUND_BLOCKED'});}},
    '../_shared/verifyTurnstile.ts':{verifyTurnstileToken:async()=>({ok:captcha}),TURNSTILE_GENERIC_ERROR:'Complete verification'},
    'https://esm.sh/@supabase/supabase-js@2.38.0':{createClient:(_url,key)=>{keys.push(key);return client;}},
    '../_shared/aacEmailTemplate.ts':{buildAacEmail:({body})=>body},
  },{SUPABASE_URL:project,SUPABASE_SERVICE_ROLE_KEY:'offline-service'},async()=>Response.json({paused:true}));
  const request=extra=>new Request('https://local.invalid',{method:'POST',body:JSON.stringify({agentEmail:'forged@example.invalid',agentId:ownerId,agentName:'Forged',senderName:'Sender Fixture',senderEmail:'sender@example.invalid',message:'Fixture message',subject:'Fixture subject',...extra})});
  return {endpoint,request,rows,keys,calls};
}
test('profile contact rejects unsigned/non-network requests and unknown directory recipients',async()=>{
  for(const options of [{signed:false},{recipient:false}]) {
    const f=profileContactFixture(options);
    assert.equal((await f.endpoint.handler(f.request())).status,options.signed===false?403:404);
    assert.equal(f.rows.length,0);
  }
});
test('network profile contact resolves the actual agent and keeps email-based callers compatible',async()=>{
  for(const extra of [{},{agentId:undefined,agentEmail:'actual-agent@example.invalid'}]) {
    const f=profileContactFixture();const response=await f.endpoint.handler(f.request(extra));
    assert.equal(response.status,200);assert.equal(f.rows[0].value.payload.to,'actual-agent@example.invalid');
    assert.ok(f.keys.every(key=>key==='offline-service'));
    assert.equal(f.calls.filter(call=>call.name==='rate_limit_consume').length,3);
    assert.equal(f.rows[0].value.payload.html.includes('Forged'),false);
  }
});
test('profile contact rate limiting fails closed on denial or limiter errors',async()=>{
  for(const options of [{limited:true},{limiterError:true}]) {
    const f=profileContactFixture(options);
    assert.equal((await f.endpoint.handler(f.request())).status,429);assert.equal(f.rows.length,0);
  }
});
test('DCMLS profile inquiries require both verification and an eligible publication',async()=>{
  for(const [options,status] of [[{signed:false,captcha:false},403],[{signed:false,published:false},404],[{signed:false},200]]) {
    const f=profileContactFixture(options);
    assert.equal((await f.endpoint.handler(f.request({dcmls:true,turnstile_token:'offline-check'}))).status,status);
    assert.equal(f.rows.length,status===200?1:0);
    if(status===200)assert.equal(f.rows[0].value.payload.to,'published-agent@example.invalid');
    assert.equal(f.calls.some(call=>call.name==='filter'),false);
  }
});
test('administrator profile correspondence retains deliberate early-access outreach',async()=>{
  const f=profileContactFixture({admin:true,recipient:false});
  assert.equal((await f.endpoint.handler(f.request({agentId:undefined,agentEmail:'early-access@example.invalid'}))).status,200);
  assert.equal(f.rows[0].value.payload.to,'early-access@example.invalid');
});
test('profile correspondence does not queue while migration delivery is paused',async()=>{
  const f=profileContactFixture({paused:true});
  assert.equal((await f.endpoint.handler(f.request())).status,503);assert.equal(f.rows.length,0);assert.equal(f.keys.length,0);
});

test('favorites sharing rejects unsigned/legacy content and forwards only an authorized listing-ID request',async()=>{
  let signed=false;const calls=[];
  const caller={userId:'fixture-agent',ownerId,client:{functions:{invoke:async(name,args)=>{calls.push({name,args});return {data:{success:true},error:null};}}}};
  const endpoint=load('supabase/functions/send-favorites-share/index.ts',{
    '../_shared/privacyAuth.ts':{verifiedPrivacyClient:async()=>signed?caller:null},
    '../_shared/migrationSafety.ts':{assertMigrationDeliveryAllowed(){}},
  });
  const request=body=>new Request('https://local.invalid',{method:'POST',body:JSON.stringify(body)});
  const legacy={recipientEmail:'buyer@example.invalid',properties:[{address:'Untrusted HTML'}],shareLink:'https://evil.invalid'};
  assert.equal((await endpoint.handler(request(legacy))).status,403);
  signed=true;assert.equal((await endpoint.handler(request(legacy))).status,400);assert.equal(calls.length,0);
  assert.equal((await endpoint.handler(request({...legacy,listingIds:[publicListingId,publicListingId],senderName:'Spoof'}))).status,200);
  assert.equal(calls[0].name,'send-bulk-listing-share');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args.body)),{listingIds:[publicListingId],recipientEmail:'buyer@example.invalid',recipientName:''});
});

const cronAuth=load('supabase/functions/_shared/internalServiceRoleAuth.ts',{
  './commsDigestCronAuth.ts':load('supabase/functions/_shared/commsDigestCronAuth.ts').exports,
},{SUPABASE_SERVICE_ROLE_KEY:'offline-service'}).exports;
function priceAlertFixture({authorized=true,network=false,paused=false,rpcError=false,changedAt='2099-01-01T00:00:00Z'}={}) {
  const rows=[];const calls=[];const updates=[];
  const changes=[{id:'approved-change',listing_id:publicListingId,old_price:600000,new_price:500000,changed_at:changedAt,favorite:{user_id:'fixture-buyer'}},
    {id:'private-change',listing_id:privateListingId,old_price:900000,new_price:800000,changed_at:changedAt,favorite:{user_id:'fixture-buyer'}}];
  const client={rpc:async(name,args)=>{
    calls.push({name,args});
    if(name!=='get_price_alert_context')throw new Error('Unexpected RPC '+name);
    return {data:authorized&&args.p_listing_id===publicListingId?{email:'buyer@example.invalid',listing:{address:'123 Authorized Rd',city:'Testville',state:'MA'},
      scope:{listing_id:publicListingId,network,...(network?{}:{hot_sheet_id:buyerSheetId,authorized_at:'2026-11-10T00:00:00Z'})}}:null,error:rpcError?new Error('authorization down'):null};
  },from:table=>{
    if(table!=='favorite_price_history'&&table!=='email_jobs')throw new Error('Unsafe lookup '+table);
    const query={select:()=>query,eq:()=>query,order:()=>query,in:(_key,ids)=>{updates.push(ids);return query;},update:()=>query,
      then:resolve=>resolve({data:changes,error:null}),insert:async value=>{rows.push({table,value});return {error:null};}};
    return query;
  }};
  const endpoint=load('supabase/functions/send-price-change-notification/index.ts',{
    '../_shared/internalServiceRoleAuth.ts':cronAuth,
    '../_shared/migrationSafety.ts':{assertMigrationDeliveryAllowed(){if(paused)throw Object.assign(new Error('paused'),{code:'MIGRATION_OUTBOUND_BLOCKED'});}},
    '../_shared/listingPhotoUrl.ts':load('supabase/functions/_shared/listingPhotoUrl.ts').exports,
    '../_shared/listingShareEmailAddress.ts':load('supabase/functions/_shared/listingShareEmailAddress.ts').exports,
    '../_shared/aacPublicUrl.ts':{resolveEmailBaseUrl:()=> 'https://example.invalid'},
    'https://esm.sh/@supabase/supabase-js@2':{createClient:()=>{calls.push({name:'createClient'});return client;}},
  },{SUPABASE_URL:project,SUPABASE_SERVICE_ROLE_KEY:'offline-service'},async()=>Response.json({paused:true}));
  const request=(token='offline-service')=>new Request('https://local.invalid',{method:'POST',headers:{Authorization:'Bearer '+token},body:'{}'});
  return {endpoint,request,rows,calls,updates};
}
test('price-alert production requires internal credentials and an open delivery gate before any lookup',async()=>{
  for(const [options,token,status] of [[{},'ordinary-user-jwt',401],[{paused:true},'offline-service',503]]) {
    const f=priceAlertFixture(options);
    assert.equal((await f.endpoint.handler(f.request(token))).status,status);assert.equal(f.rows.length,0);assert.equal(f.calls.length,0);
  }
});
test('buyer price alerts include only current approved favorites with neutral media and member-scoped links',async()=>{
  const f=priceAlertFixture();assert.equal((await f.endpoint.handler(f.request())).status,200);
  assert.equal(f.rows.length,1);const payload=f.rows[0].value.payload;
  assert.ok(payload.html.includes('123 Authorized Rd'));assert.ok(payload.html.includes('/og/aac-og-2026-01-22.jpg'));
  assert.ok(payload.html.includes('/client/shared-property/'+publicListingId+'?sheet='+buyerSheetId));
  assert.equal(payload.html.includes('/storage/v1/'),false);assert.equal(payload.html.includes(privateListingId),false);
  assert.deepEqual(JSON.parse(JSON.stringify(payload.privacy.listing_ids)),[publicListingId]);
  assert.equal(payload.privacy.recipient_user_id,'fixture-buyer');assert.equal(payload.to,'buyer@example.invalid');
  assert.deepEqual(JSON.parse(JSON.stringify(f.updates)),[['approved-change']]);
});
test('price-alert authorization failures, absent access and pre-authorization history cannot queue emails',async()=>{
  for(const [options,status] of [[{authorized:false},200],[{rpcError:true},500],[{changedAt:'2025-01-01T00:00:00Z'},200]]) {
    const f=priceAlertFixture(options);assert.equal((await f.endpoint.handler(f.request())).status,status);
    assert.equal(f.rows.length,0);assert.equal(f.updates.length,0);
  }
});
test('internal agent price alerts retain the guarded network property route',async()=>{
  const f=priceAlertFixture({network:true});assert.equal((await f.endpoint.handler(f.request())).status,200);
  assert.ok(f.rows[0].value.payload.html.includes('/property/'+publicListingId));
  assert.equal(f.rows[0].value.payload.privacy.scopes[0].network,true);
});
test('price-alert and legacy favorites templates cannot reach a provider without a current contract',async()=>{
  const privacy=load('supabase/functions/_shared/privacyEmail.ts').exports;
  let allowed=false;let sent=0;
  const sender=load('supabase/functions/_shared/sendEmail.ts',{
    './migrationSafety.ts':{assertMigrationDeliveryAllowed(){}},'./privacyEmail.ts':privacy,
    './renderEmailTemplate.ts':{renderEmailTemplate:()=>'<p>Fixture</p>'},
    './transactionalSender.ts':{buildTransactionalFrom:()=> 'AAC <test@example.invalid>'},'./tracking.ts':{},
    './emailCategories.ts':{isSubscriptionCategory:()=>false},
    'https://esm.sh/@supabase/supabase-js@2.39.3':{createClient:()=>({rpc:async()=>({data:allowed,error:null})})},
  },{SUPABASE_URL:project,SUPABASE_SERVICE_ROLE_KEY:'offline'},async()=>{sent++;return Response.json({id:'offline-provider'});}).exports;
  for(const template of ['price-change-notification','favorites-share']) {
    const job={id:'fixture-job',payload:{template,to:'buyer@example.invalid',subject:'Fixture',html:'<p>Authorized content</p>'}};
    await assert.rejects(sender.sendEmail(job,'offline'),/Privacy email blocked/);
    job.payload.privacy={version:1};await assert.rejects(sender.sendEmail(job,'offline'),/Privacy email blocked/);
    assert.equal(sent,0);
  }
  allowed=true;
  await sender.sendEmail({id:'fixture-job',payload:{template:'price-change-notification',to:'buyer@example.invalid',subject:'Fixture',html:'<p>Authorized content</p>',privacy:{version:1}}},'offline');
  assert.equal(sent,1);
});
