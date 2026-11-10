import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
const ids = Object.fromEntries(['owner','sharer','other','hidden','unverified','invited','restricted','buyer','listing','second','sheet','admin','delegate'].map((name, i) => [name, `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`]));

test('privacy lockdown against the real supplied destination schema, fake rows only', async t => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const as = async (role, id, fn) => {
    await db.exec(`SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub', '${id ?? ''}', false); SELECT set_config('request.jwt.claim.role', '${role}', false); SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: id ?? '', role })}', false);`);
    try { return await fn(); } finally { await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false); SELECT set_config('request.jwt.claim.role', '', false); SELECT set_config('request.jwt.claims', '{}', false);`); }
  };
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions; CREATE SCHEMA drizzle;
      CREATE SCHEMA migration_safety; CREATE SCHEMA cron; CREATE SCHEMA net; CREATE SCHEMA vault;
      CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
      CREATE FUNCTION extensions.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
      GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;`);
    await db.exec(await read('supabase/tests/db/24_privacy_real_schema.sql'));
    await db.exec(`CREATE TABLE cron.job(jobid bigint, active boolean); CREATE TABLE net.http_request_queue(id bigint);
      SET session_replication_role=replica;`);
    for (const name of ['owner','sharer','other','hidden','unverified','invited','restricted','buyer','admin','delegate']) {
      const id = ids[name];
      await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now());`, [id, `${name}@example.invalid`]);
      await db.query(`INSERT INTO public.profiles(id,email,first_name,last_name) VALUES($1,$2,$3,'Fixture');`, [id, `${name}@example.invalid`, name]);
      if (name !== 'buyer') {
        await db.query(`INSERT INTO public.agent_profiles(id,email,first_name,last_name) VALUES($1,$2,$3,'Fixture')`, [id, `${name}@example.invalid`, name]);
        await db.query(`INSERT INTO public.agent_settings(user_id,agent_status,hide_from_directory,account_activated_at) VALUES($1,$2,$3,now())`,
          [id, ['unverified','invited','restricted'].includes(name) ? name : 'verified', name === 'hidden']);
        await db.query(`INSERT INTO public.user_roles(user_id,role) VALUES($1,'agent')`, [id]);
      }
    }
    await db.query(`INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')`, [ids.admin]);
    await db.query(`INSERT INTO public.listings(id,agent_id,address,city,state,zip_code,price,status,listing_number,photos,floor_plans,lockbox_code,broker_comments)
      VALUES($1,$2,'123 Fake Street','Testville','MA','00000',500000,'active','FIX-1',
      '[{"url":"https://kwfqjnepesiihjkdnxou.supabase.co/storage/v1/object/public/listing-photos/fake/one.png"}]',
      '[{"path":"fake/plan.png"}]','PRIVATE-LOCKBOX','PRIVATE-BROKER')`, [ids.listing, ids.owner]);
    await db.query(`INSERT INTO public.listings(id,agent_id,address,city,state,zip_code,price,status,listing_number)
      VALUES($1,$2,'456 Other Fake Street','Testville','MA','00000',600000,'active','FIX-2')`, [ids.second, ids.other]);
    await db.query(`INSERT INTO public.hot_sheets(id,user_id,name,criteria,is_active) VALUES($1,$2,'Fake Sheet','{"statuses":["active"],"clientEmail":"private-client@example.invalid","internal_notes":"PRIVATE-NOTES"}',true)`, [ids.sheet, ids.sharer]);
    await db.query(`INSERT INTO public.share_tokens(token,agent_id,payload,expires_at) VALUES('fake-hot-sheet-token-valid-1234567890',$1,$2,now()+interval '1 day')`,
      [ids.sharer, { type: 'client_hotsheet_invite', hot_sheet_id: ids.sheet, client_email: 'buyer@example.invalid', secret_extra: 'NOT-PUBLIC' }]);
    await db.exec('SET session_replication_role=origin; SET check_function_bodies=on;');
    // Install the actual migration safety lock as well, so the release runner's
    // before/after guard checks execute against real quarantined dispatchers.
    // The dump already contains the eight guard bodies; reconstruct only their
    // fake backup metadata, with no historical credentials or queue contents.
    await db.exec(`INSERT INTO migration_safety.function_backup(signature,function_oid,definition,guard_body)
      SELECT p.oid::regprocedure::text,p.oid,pg_get_functiondef(p.oid),p.prosrc FROM pg_proc p
      WHERE p.pronamespace='public'::regnamespace AND p.prosrc LIKE '%MIGRATION_OUTBOUND_BLOCKED: database dispatcher is quarantined%';`);
    await db.exec(await read('scripts/migration/lock-destination.sql'));
    const quarantineBefore = (await db.query('SELECT signature,guard_body FROM migration_safety.function_backup ORDER BY signature')).rows;
    // Exercise a column-only anonymous grant too; table-wide REVOKE alone
    // would miss this direct address/email leak.
    await db.exec('GRANT SELECT(address) ON public.listings TO anon; GRANT SELECT(email) ON public.agent_profiles TO anon;');
    const migration = await read('supabase/migrations/20261110120000_privacy_lockdown.sql');
    const runner = (await read('docs/privacy-lockdown/apply-in-migration.sql'))
      .replace(/^\\ir .*$/m, () => migration).replace(/^\\.*$/gm, '')
      + '\n' + await read('supabase/migrations/20261110143000_privacy_workflow_repairs.sql')
      + '\n' + await read('supabase/migrations/20261110160000_privacy_access_boundary_fixes.sql');
    await db.exec(runner);
    await t.test('buyers cannot directly create representation or insert private inquiries/showings', async()=>{
      await db.exec('BEGIN');
      try {
        const crm='00000000-0000-4000-8000-000000000901';
        await db.exec('SET session_replication_role=replica');
        await db.query(`INSERT INTO public.clients(id,agent_id,first_name,last_name,email) VALUES($1,$2,'Other','Recipient','other-recipient@example.invalid')`,[crm,ids.sharer]);
        await db.exec('SET session_replication_role=origin');
        await as('authenticated',ids.buyer,async()=>{
          for(const [sql,params] of [
            [`INSERT INTO public.client_agent_relationships(client_id,agent_id,crm_client_id,status) VALUES($1,$2,$3,'active')`,[ids.buyer,ids.sharer,crm]],
            [`INSERT INTO public.agent_messages(listing_id,agent_id,sender_name,sender_email,message) VALUES($1,$2,'Fixture','buyer@example.invalid','Fixture')`,[ids.listing,ids.other]],
            [`INSERT INTO public.showing_requests(listing_id,requester_name,requester_email,preferred_date,preferred_time) VALUES($1,'Fixture','buyer@example.invalid','2099-01-01','10:00')`,[ids.listing]],
          ]) {
            await db.exec('SAVEPOINT denied');
            try { await assert.rejects(db.query(sql,params),/permission denied|row-level security/); }
            finally { await db.exec('ROLLBACK TO denied; RELEASE denied'); }
          }
        });
        await as('service_role',null,async()=>{
          await db.query(`INSERT INTO public.agent_messages(listing_id,agent_id,sender_name,sender_email,message) VALUES($1,$2,'Fixture','buyer@example.invalid','Fixture')`,[ids.listing,ids.owner]);
          await db.query(`INSERT INTO public.showing_requests(listing_id,requester_name,requester_email,preferred_date,preferred_time) VALUES($1,'Fixture','buyer@example.invalid','2099-01-01','10:00')`,[ids.listing]);
        });
      } finally { await db.exec('ROLLBACK'); }
    });
    await t.test('existing forged relationships and mutable profile email cannot authorize listing or media access',async()=>{
      await db.exec('BEGIN');
      try {
        const crm='00000000-0000-4000-8000-000000000902';
        await db.exec('SET session_replication_role=replica');
        await db.query(`INSERT INTO public.clients(id,agent_id,first_name,last_name,email) VALUES($1,$2,'Other','Recipient','other-recipient@example.invalid')`,[crm,ids.sharer]);
        await db.query('UPDATE public.hot_sheets SET client_id=$1 WHERE id=$2',[crm,ids.sheet]);
        await db.query(`INSERT INTO public.client_agent_relationships(client_id,agent_id,crm_client_id,status) VALUES($1,$2,$3,'active')`,[ids.buyer,ids.sharer,crm]);
        await db.query(`UPDATE public.profiles SET email='other-recipient@example.invalid' WHERE id=$1`,[ids.buyer]);
        await db.exec('SET session_replication_role=origin');
        await as('authenticated',ids.owner,()=>db.query(`SELECT public.set_listing_external_sharing($1,true,'Seller authorization fixture')`,[ids.listing]));
        await as('authenticated',ids.buyer,async()=>{
          assert.equal((await one('SELECT public.is_hot_sheet_participant($1) result',[ids.sheet])).result,false);
          assert.equal((await one('SELECT public.get_buyer_listing($1,$2) result',[ids.listing,ids.sheet])).result,null);
          assert.equal((await one('SELECT public.get_shared_listing_photo_paths(NULL,$1,$2) result',[ids.listing,ids.sheet])).result,null);
          assert.equal((await one('SELECT public.can_authenticated_buyer_view_hot_sheet_client($1,$2) result',[ids.sheet,crm])).result,false);
          for(const sql of ['SELECT public.activate_agent_relationship($1,$2)','SELECT public.activate_agent_relationship($1::uuid)']) {
            await db.exec('SAVEPOINT denied');
            try { await assert.rejects(db.query(sql,sql.includes('$2')?[ids.sharer,crm]:[ids.sharer]),/not_authorized/); }
            finally { await db.exec('ROLLBACK TO denied; RELEASE denied'); }
          }
        });
      } finally { await db.exec('ROLLBACK'); }
    });
    await t.test('agent-created pending relationships and intended-recipient activation remain available',async()=>{
      await db.exec('BEGIN');
      try {
        const crm='00000000-0000-4000-8000-000000000903';
        const token='fixture-activation-recipient-1234567890';
        await db.exec('SET session_replication_role=replica');
        await db.query(`INSERT INTO public.clients(id,agent_id,first_name,last_name,email) VALUES($1,$2,'Buyer','Fixture','buyer@example.invalid')`,[crm,ids.sharer]);
        await db.query('UPDATE public.hot_sheets SET client_id=$1 WHERE id=$2',[crm,ids.sheet]);
        await db.exec('SET session_replication_role=origin');
        await as('authenticated',ids.sharer,async()=>{
          await db.query(`INSERT INTO public.client_agent_relationships(agent_id,crm_client_id,status) VALUES($1,$2,'pending')`,[ids.sharer,crm]);
          await db.query(`INSERT INTO public.share_tokens(token,agent_id,payload,expires_at) VALUES($1,$2,$3,now()+interval '1 day')`,[token,ids.sharer,{type:'client_hotsheet_invite',invite_only:true,client_id:crm,client_email:'buyer@example.invalid'}]);
        });
        await db.query('UPDATE public.share_tokens SET revoked_at=now() WHERE token=$1',[token]);
        await as('authenticated',ids.buyer,async()=>{
          await db.exec('SAVEPOINT denied');
          try { await assert.rejects(db.query('SELECT public.activate_agent_relationship($1,$2)',[ids.sharer,crm]),/not_authorized/); }
          finally { await db.exec('ROLLBACK TO denied; RELEASE denied'); }
        });
        await db.query('UPDATE public.share_tokens SET revoked_at=NULL WHERE token=$1',[token]);
        await as('authenticated',ids.buyer,async()=>{
          const activated=(await one('SELECT public.activate_agent_relationship($1,$2) result',[ids.sharer,crm])).result;
          assert.ok(activated);
          assert.equal((await one('SELECT public.activate_agent_relationship($1) result',[ids.sharer])).result,activated);
          assert.equal((await one('SELECT public.is_hot_sheet_participant($1) result',[ids.sheet])).result,true);
        });
        assert.equal((await one('SELECT agent_user_id FROM public.clients WHERE id=$1',[crm])).agent_user_id,ids.buyer);
        await db.query(`UPDATE auth.users SET email='changed-buyer@example.invalid' WHERE id=$1`,[ids.buyer]);
        await as('authenticated',ids.buyer,async()=>{
          assert.equal((await one('SELECT public.is_hot_sheet_participant($1) result',[ids.sheet])).result,true);
        });
      } finally { await db.exec('ROLLBACK'); }
    });
    await t.test('price-alert context is service-only and preserves internal agent access without seller opt-in',async()=>{
      await db.exec('BEGIN');
      try {
        await db.query('INSERT INTO public.favorites(user_id,listing_id) VALUES($1,$2)',[ids.sharer,ids.listing]);
        const {result}=await as('service_role',null,()=>one('SELECT public.get_price_alert_context($1,$2) result',[ids.sharer,ids.listing]));
        assert.equal(result.email,'sharer@example.invalid'); assert.equal(result.scope.network,true);
        const policy={version:1,audience:'favorite',recipient_user_id:ids.sharer,listing_ids:[ids.listing],scopes:[result.scope]};
        assert.equal((await as('service_role',null,()=>one('SELECT public.privacy_email_delivery_allowed($1,$2) result',[policy,[result.email]]))).result,true);
        for(const role of ['anon','authenticated']) assert.equal((await one(`SELECT has_function_privilege($1,'public.get_price_alert_context(uuid,uuid)','EXECUTE') result`,[role])).result,false);
      } finally { await db.exec('ROLLBACK'); }
    });
    await t.test('buyer price alerts bind actual identity, membership, favorite and authorization generation at delivery',async()=>{
      await db.exec('BEGIN');
      try {
        await db.query('INSERT INTO public.favorites(user_id,listing_id) VALUES($1,$2)',[ids.buyer,ids.listing]);
        const context=()=>as('service_role',null,()=>one('SELECT public.get_price_alert_context($1,$2) result',[ids.buyer,ids.listing]));
        assert.equal((await context()).result,null);
        await db.query(`UPDATE public.share_tokens SET accepted_at=now(),accepted_by_user_id=$1 WHERE token='fake-hot-sheet-token-valid-1234567890'`,[ids.buyer]);
        await as('authenticated',ids.owner,()=>db.query(`SELECT public.set_listing_external_sharing($1,true,'Seller authorization fixture')`,[ids.listing]));
        await db.query(`UPDATE public.profiles SET email='spoofed@example.invalid' WHERE id=$1`,[ids.buyer]);
        const {result}=await context();
        assert.equal(result.email,'buyer@example.invalid'); assert.equal(result.scope.hot_sheet_id,ids.sheet); assert.equal(result.scope.network,false);
        const policy={version:1,audience:'favorite',recipient_user_id:ids.buyer,listing_ids:[ids.listing],scopes:[result.scope]};
        const allowed=(to=['buyer@example.invalid'])=>as('service_role',null,()=>one('SELECT public.privacy_email_delivery_allowed($1,$2) result',[policy,to]));
        assert.equal((await allowed()).result,true); assert.equal((await allowed(['spoofed@example.invalid'])).result,false);
        await db.query(`UPDATE auth.users SET email='changed-buyer@example.invalid' WHERE id=$1`,[ids.buyer]);
        assert.equal((await allowed()).result,false);
        await db.query(`UPDATE auth.users SET email='buyer@example.invalid' WHERE id=$1`,[ids.buyer]);
        await db.query('DELETE FROM public.favorites WHERE user_id=$1',[ids.buyer]);
        assert.equal((await allowed()).result,false);
        await db.query('INSERT INTO public.favorites(user_id,listing_id) VALUES($1,$2)',[ids.buyer,ids.listing]);
        await db.query(`UPDATE public.share_tokens SET revoked_at=now() WHERE token='fake-hot-sheet-token-valid-1234567890'`);
        assert.equal((await allowed()).result,false);
        await db.query(`UPDATE public.share_tokens SET revoked_at=NULL WHERE token='fake-hot-sheet-token-valid-1234567890'`);
        await as('authenticated',ids.owner,()=>db.query(`SELECT public.set_listing_external_sharing($1,false,NULL)`,[ids.listing]));
        assert.equal((await allowed()).result,false);
        await as('authenticated',ids.owner,()=>db.query(`SELECT public.set_listing_external_sharing($1,true,'Renewed seller authorization fixture')`,[ids.listing]));
        assert.equal((await allowed()).result,false);
      } finally { await db.exec('ROLLBACK'); }
    });

    await t.test('transactional release runner is reapplicable and preserves every outbound quarantine', async () => {
      await db.exec(runner);
      const status = (await one('SELECT public.migration_no_contact_status() result')).result;
      assert.equal(status.database_locked, true); assert.equal(status.changed_quarantined_routines, 0);
      assert.ok(quarantineBefore.length > 0);
      assert.deepEqual((await db.query('SELECT signature,guard_body FROM migration_safety.function_backup ORDER BY signature')).rows, quarantineBefore);
    });
    await t.test('private Storage RLS denies buyer direct access while preserving agent and public branding reads', async () => {
      // Exact API-role grants from the supplied Storage schema; managed-role
      // grants are omitted from this portable fixture.
      await db.exec(`GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects,storage.buckets TO anon,authenticated;
        INSERT INTO storage.buckets(id,name,public) VALUES('listing-photos','listing-photos',false),('agent-headshots','agent-headshots',true);
        INSERT INTO storage.objects(bucket_id,name) VALUES('listing-photos','fake/one.png'),('agent-headshots','fake/headshot.png');`);
      await as('authenticated', ids.buyer, async () => {
        assert.equal((await one(`SELECT count(*)::int n FROM storage.objects WHERE bucket_id='listing-photos'`)).n, 0);
      });
      await as('authenticated', ids.sharer, async () => {
        assert.equal((await one(`SELECT count(*)::int n FROM storage.objects WHERE bucket_id='listing-photos'`)).n, 1);
      });
      await as('anon', null, async () => {
        assert.equal((await one(`SELECT count(*)::int n FROM storage.objects WHERE bucket_id='agent-headshots'`)).n, 1);
        assert.equal((await one(`SELECT count(*)::int n FROM storage.objects WHERE bucket_id='listing-photos'`)).n, 0);
      });
    });
    await t.test('anonymous direct listing/profile reads and network RPC execution are refused', async () => {
      await as('anon', null, async () => {
        for (const sql of ['SELECT * FROM public.listings','SELECT address FROM public.listings','SELECT email FROM public.agent_profiles','SELECT * FROM public.listings_public','SELECT * FROM public.agent_profiles', `SELECT public.get_public_listing('${ids.listing}')`]) {
          await assert.rejects(db.query(sql), /permission denied/);
        }
      });
      const accessible = (await db.query(`SELECT c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace
        AND c.relkind IN ('r','p','v','m','f') AND has_any_column_privilege('anon',c.oid,'SELECT') ORDER BY c.relname`)).rows.map(r => r.relname);
      assert.deepEqual(accessible, ['counties','dcmls_listings_public']);
    });
    await t.test('unverified, invited, restricted and buyer accounts cannot read network rows', async () => {
      for (const role of ['unverified','invited','restricted','buyer']) await as('authenticated', ids[role], async () => {
        assert.equal((await one('SELECT count(*)::int n FROM public.listings')).n, 0);
        assert.equal((await one('SELECT count(*)::int n FROM public.listings_public')).n, 0);
        assert.equal((await one(`SELECT count(*)::int n FROM public.get_public_listing('${ids.listing}')`)).n, 0);
      });
    });
    await t.test('verified agent listing access survives and hidden directory rows stay private', async () => {
      await as('authenticated', ids.sharer, async () => {
        assert.equal((await one('SELECT count(*)::int n FROM public.listings_public')).n, 2);
        assert.equal((await one(`SELECT count(*)::int n FROM public.agent_profiles WHERE id='${ids.hidden}'`)).n, 0);
        assert.equal((await one(`SELECT public.get_public_agent_profile('${ids.hidden}') result`)).result, null);
      });
      await as('authenticated', ids.admin, async () => {
        assert.equal((await one(`SELECT count(*)::int n FROM public.agent_profiles WHERE id IN ('${ids.hidden}','${ids.unverified}')`)).n, 2);
      });
      await as('authenticated', ids.hidden, async () => {
        assert.equal((await one(`SELECT count(*)::int n FROM public.agent_profiles WHERE id='${ids.hidden}'`)).n, 1);
      });
    });
    await t.test('external sharing defaults off and cannot be enabled by another agent or a buyer', async () => {
      assert.equal((await one('SELECT external_sharing_allowed FROM public.listings WHERE id=$1', [ids.listing])).external_sharing_allowed, false);
      await as('authenticated', ids.sharer, async () => {
        await assert.rejects(db.query('SELECT public.create_listing_share_link($1)', [ids.listing]), /listing_not_shareable/);
        await assert.rejects(db.query('SELECT public.set_listing_external_sharing($1,true,$2)', [ids.listing, 'Recorded seller approval']), /not_authorized/);
      });
      await as('authenticated', ids.owner, async () => {
        await assert.rejects(db.query('SELECT public.set_listing_external_sharing($1,true,$2)', [ids.listing, '']), /Record the seller/);
        await db.query('SELECT public.set_listing_external_sharing($1,true,$2)', [ids.listing, 'Seller explicitly permits buyer links under the recorded marketing restrictions']);
      });
    });
    let token;
    await t.test('verified sharer creates a strong hashed token; safe response contains only their card', async () => {
      token = await as('authenticated', ids.sharer, async () => (await one('SELECT public.create_listing_share_link($1) token', [ids.listing])).token);
      assert.match(token, /^[0-9a-f]{64}$/);
      const stored = await one('SELECT * FROM public.listing_share_links LIMIT 1');
      assert.equal(JSON.stringify(stored).includes(token), false);
      const result = await as('anon', null, async () => (await one('SELECT public.get_shared_listing($1) result', [token])).result);
      assert.equal(result.agent.id, ids.sharer);
      assert.equal(result.listing.id, ids.listing);
      for (const secret of ['PRIVATE-LOCKBOX','PRIVATE-BROKER','owner@example.invalid','storage/v1/object','token_hash']) assert.equal(JSON.stringify(result).includes(secret), false);
      assert.match(result.listing.photos[0].url, /^aac-private:\/\//);
    });
    let replacement;
    await t.test('only the creator can replace/revoke; replacement invalidates the old token atomically', async () => {
      const link = await one('SELECT id FROM public.listing_share_links LIMIT 1');
      await as('authenticated', ids.other, async () => {
        assert.equal((await one('SELECT public.revoke_listing_share_link($1) result', [link.id])).result, false);
        await assert.rejects(db.query('SELECT public.replace_listing_share_link($1)', [link.id]), /not_authorized/);
      });
      replacement = await as('authenticated', ids.sharer, async () => (await one('SELECT public.replace_listing_share_link($1) token', [link.id])).token);
      assert.equal((await one('SELECT public.get_shared_listing($1) result', [token])).result, null);
      assert.ok((await one('SELECT public.get_shared_listing($1) result', [replacement])).result);
    });
    await t.test('seller opt-out immediately invalidates shares and removes buyer Hot Sheet matches', async () => {
      await as('authenticated', ids.owner, () => db.query('SELECT public.set_listing_external_sharing($1,false)', [ids.listing]));
      assert.equal((await one('SELECT public.get_shared_listing($1) result', [replacement])).result, null);
      const result = (await one(`SELECT public.get_shared_hot_sheet('fake-hot-sheet-token-valid-1234567890') result`)).result;
      assert.equal(result.listings.length, 0);
      await as('authenticated', ids.owner, () => db.query('SELECT public.set_listing_external_sharing($1,true,$2)', [ids.listing, 'Seller explicitly permits buyer links']));
      assert.equal((await one('SELECT public.get_shared_listing($1) result', [replacement])).result, null);
      replacement = await as('authenticated', ids.sharer, async () => (await one('SELECT public.create_listing_share_link($1) token', [ids.listing])).token);
    });
    await t.test('valid legacy Hot Sheet is scoped, strips extra token payload and shows the sharing agent', async () => {
      const result = await as('anon', null, async () => (await one(`SELECT public.get_shared_hot_sheet('fake-hot-sheet-token-valid-1234567890') result`)).result);
      assert.equal(result.listings.length, 1);
      assert.equal(result.agent.id, ids.sharer);
      assert.equal(result.listings[0].id, ids.listing);
      assert.deepEqual(result.hot_sheet.criteria, { statuses: ['active'] });
      const payload = (await one(`SELECT public.resolve_share_token('fake-hot-sheet-token-valid-1234567890') result`)).result;
      assert.equal(JSON.stringify(payload).includes('NOT-PUBLIC'), false);
      assert.equal('token' in payload, false);
    });
    await t.test('buyer-safe view and favorites are bound to the accepted recipient, with no listing-agent fields', async () => {
      await db.query(`UPDATE public.share_tokens SET accepted_at=now(),accepted_by_user_id=$1 WHERE token='fake-hot-sheet-token-valid-1234567890'`, [ids.buyer]);
      await db.exec('SET session_replication_role=replica;');
      await db.query('INSERT INTO public.favorites(user_id,listing_id) VALUES($1,$2)', [ids.buyer, ids.listing]);
      await db.exec('SET session_replication_role=origin;');
      await as('authenticated', ids.buyer, async () => {
        const rows = (await db.query('SELECT * FROM public.buyer_listings')).rows;
        assert.equal(rows.length, 1); assert.equal(rows[0].agent_id, null);
        assert.equal('lockbox_code' in rows[0], false);
        assert.equal((await one('SELECT public.get_buyer_listing($1) result', [ids.listing])).result.agent.id, ids.sharer);
        assert.equal((await db.query('SELECT * FROM public.list_buyer_favorites()')).rows.length, 1);
        assert.ok((await one('SELECT public.get_shared_listing_photo_paths(NULL,$1) result', [ids.listing])).result);
      });
      await as('authenticated', ids.unverified, async () => {
        // A buyer cannot become another recipient by editing a public profile email.
        await db.query('UPDATE public.profiles SET email=$1 WHERE id=$2', ['buyer@example.invalid', ids.unverified]);
        assert.equal((await one('SELECT count(*)::int n FROM public.buyer_listings')).n, 0);
        assert.equal((await one('SELECT public.get_buyer_listing($1) result', [ids.listing])).result, null);
        assert.equal((await db.query('SELECT * FROM public.list_buyer_favorites()')).rows.length, 0);
      });
    });
    await t.test('revoked/expired and cross-owner legacy tokens cannot expose a Hot Sheet', async () => {
      await db.query(`INSERT INTO public.share_tokens(token,agent_id,payload) VALUES('fake-cross-owner-token-1234567890',$1,$2)`,
        [ids.other, { type: 'client_hotsheet_invite', hot_sheet_id: ids.sheet }]);
      assert.equal((await one(`SELECT public.get_shared_hot_sheet('fake-cross-owner-token-1234567890') result`)).result, null);
      await db.query(`UPDATE public.share_tokens SET revoked_at=now() WHERE token='fake-hot-sheet-token-valid-1234567890'`);
      assert.equal((await one(`SELECT public.get_shared_hot_sheet('fake-hot-sheet-token-valid-1234567890') result`)).result, null);
      await as('authenticated', ids.buyer, async () => {
        assert.equal((await one('SELECT count(*)::int n FROM public.buyer_listings')).n, 0);
        assert.equal((await one(`SELECT public.get_hot_sheet_for_member('${ids.sheet}') result`)).result, null);
      });
      await db.exec(`UPDATE public.share_tokens SET revoked_at=NULL,expires_at=now()-interval '1 hour' WHERE token='fake-hot-sheet-token-valid-1234567890'`);
      await as('authenticated', ids.buyer, async () => {
        assert.equal((await one(`SELECT public.accept_client_hot_sheet_invite('fake-hot-sheet-token-valid-1234567890') result`)).result, null);
      });
      await db.exec(`UPDATE public.share_tokens SET expires_at=now()+interval '1 day' WHERE token='fake-hot-sheet-token-valid-1234567890'`);
    });
    await t.test('token media authorization refuses a different listing and revoked/expired tokens', async () => {
      assert.equal((await one('SELECT public.get_shared_listing_photo_paths($1,$2) result', [replacement, ids.second])).result, null);
      assert.ok((await one('SELECT public.get_shared_listing_photo_paths($1,$2) result', [replacement, ids.listing])).result);
      await db.query(`UPDATE public.listing_share_links SET expires_at=now()-interval '1 hour',created_at=now()-interval '1 day' WHERE token_hash=extensions.digest($1,'sha256')`, [replacement]);
      assert.equal((await one('SELECT public.get_shared_listing($1) result', [replacement])).result, null);
      assert.equal((await one('SELECT public.get_shared_listing_photo_paths($1,$2) result', [replacement, ids.listing])).result, null);
      assert.equal((await one(`SELECT public.get_shared_listing('invalid') result`)).result, null);
    });
    await t.test('replacement requests notify only the sharing agent, throttle duplicates, and enqueue no email', async () => {
      const before = (await one('SELECT count(*)::int n FROM public.email_jobs')).n;
      await as('authenticated', ids.buyer, async () => {
        await db.query('SELECT public.request_new_listing_share_link($1)', [token]);
        await db.query('SELECT public.request_new_listing_share_link($1)', [token]);
        await db.query('SELECT public.request_new_listing_share_link($1)', ['0'.repeat(64)]);
      });
      const rows = (await db.query(`SELECT agent_id FROM public.agent_notifications WHERE type='share_link_request'`)).rows;
      assert.deepEqual(rows.map(r => r.agent_id), [ids.sharer]);
      assert.equal((await one('SELECT count(*)::int n FROM public.email_jobs')).n, before);
    });
    await t.test('email authorization blocks legacy jobs, unapproved listings and changed/revoked shares', async () => {
      const check = (policy, to = ['buyer@example.invalid']) => as('service_role', null, async () =>
        (await one('SELECT public.privacy_email_delivery_allowed($1,$2) allowed', [policy,to])).allowed);
      const external = { version: 1, audience: 'external', listing_ids: [ids.listing], hot_sheet_id: ids.sheet };
      assert.equal(await check(null), false);
      assert.equal(await check(external), true);
      assert.equal(await check({ ...external, listing_ids: [ids.second] }), false);
      assert.equal(await check({ ...external, audience: 'agent' }, ['buyer@example.invalid']), false);
      assert.equal(await check({ ...external, audience: 'agent' }, ['sharer@example.invalid']), true);
      assert.equal(await check({ version: 1, audience: 'agent', listing_ids: [ids.listing] }, ['sharer@example.invalid']), true);
      assert.equal(await check({ version: 1, audience: 'agent', listing_ids: [ids.listing] }, ['buyer@example.invalid']), false);
      assert.equal(await check({ ...external, listing_ids: ['malformed'] }), false);
      const fresh = await as('authenticated', ids.sharer, async () => (await one('SELECT public.create_listing_share_link($1) token', [ids.listing])).token);
      const direct = { version: 1, audience: 'external', listing_ids: [ids.listing], share_tokens: [{ token: fresh }] };
      assert.equal(await check(direct), true);
      await db.query(`UPDATE public.listing_share_links SET revoked_at=now() WHERE token_hash=extensions.digest($1,'sha256')`, [fresh]);
      assert.equal(await check(direct), false);
      await as('authenticated', ids.owner, () => db.query('SELECT public.set_listing_external_sharing($1,false)', [ids.listing]));
      assert.equal(await check(external), false);
      assert.equal(await check({ ...external, audience: 'agent' }, ['sharer@example.invalid']), true);
      await as('authenticated', ids.owner, () => db.query('SELECT public.set_listing_external_sharing($1,true,$2)', [ids.listing, 'Seller explicitly permits buyer links']));
      await as('authenticated', ids.buyer, () => assert.rejects(db.query('SELECT public.privacy_email_delivery_allowed($1,$2)', [external,['buyer@example.invalid']]), /permission denied/));
    });
    await t.test('existing lifecycle protection prevents an unverified account promoting itself', async () => {
      await as('authenticated', ids.unverified, async () => {
        await assert.rejects(db.query(`UPDATE public.agent_settings SET agent_status='verified' WHERE user_id=$1`, [ids.unverified]), /cannot modify verification/);
        assert.equal((await one('SELECT public.privacy_network_access() allowed')).allowed, false);
      });
    });
    await t.test('accepted delegates keep the owner context but cannot record the seller authorization', async () => {
      await db.exec('SET session_replication_role=replica;');
      await db.query(`INSERT INTO public.feature_flags(flag_name,enabled) VALUES('agent_account_delegates',true) ON CONFLICT(flag_name) DO UPDATE SET enabled=true`);
      await db.query(`UPDATE public.agent_settings SET agent_status='pending' WHERE user_id=$1`, [ids.delegate]);
      await db.query(`INSERT INTO public.agent_account_members(owner_user_id,delegate_user_id,invite_email,status,invited_by,accepted_at)
        VALUES($1,$2,'delegate@example.invalid','accepted',$1,now())`, [ids.sharer,ids.delegate]);
      await db.exec('SET session_replication_role=origin;');
      await as('authenticated', ids.delegate, async () => {
        assert.equal((await one('SELECT public.privacy_network_access() allowed')).allowed, true);
        const delegatedToken = (await one('SELECT public.create_listing_share_link($1) token', [ids.listing])).token;
        assert.equal((await one('SELECT public.get_shared_listing($1) result', [delegatedToken])).result.agent.id, ids.sharer);
        await assert.rejects(db.query('SELECT public.set_listing_external_sharing($1,true,$2)', [ids.listing,'Delegate cannot give seller approval']), /not_authorized/);
      });
      await db.query('INSERT INTO public.favorites(user_id,listing_id) VALUES($1,$2)',[ids.delegate,ids.listing]);
      const priceContext=()=>as('service_role',null,()=>one('SELECT public.get_price_alert_context($1,$2) result',[ids.delegate,ids.listing]));
      assert.equal((await priceContext()).result.scope.network,true);
      await db.exec(`UPDATE public.feature_flags SET enabled=false WHERE flag_name='agent_account_delegates'`);
      assert.equal((await priceContext()).result,null);
      await db.query('DELETE FROM public.favorites WHERE user_id=$1',[ids.delegate]);
    });
    await t.test('system-only functions and hidden implementations are inaccessible to API roles', async () => {
      for (const role of ['anon','authenticated']) {
        assert.equal((await one(`SELECT has_function_privilege($1,'public.cleanup_orphan_auth_identity(text)','EXECUTE') allowed`, [role])).allowed, false);
        assert.equal((await one(`SELECT has_schema_privilege($1,'aac_privacy','USAGE') allowed`, [role])).allowed, false);
      }
      assert.equal((await one(`SELECT has_function_privilege('authenticated','public.generate_listing_number()','EXECUTE') allowed`)).allowed, true);
      assert.equal((await one(`SELECT has_function_privilege('anon','public.migration_no_contact_status()','EXECUTE') allowed`)).allowed, true);
    });
    await t.test('anonymous function access is an exact allowlist, not inherited PUBLIC privileges', async () => {
      const actual = (await db.query(`SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND has_function_privilege('anon',oid,'EXECUTE') ORDER BY proname`)).rows.map(r => r.proname);
      assert.deepEqual(actual, ['get_dcmls_agent_profile','get_dcmls_consumer_listings','get_dcmls_listing','get_dcmls_listing_agent','get_delegate_invite_preview','get_hot_sheet_by_token','get_shared_hot_sheet','get_shared_listing','get_verified_early_access_count','migration_no_contact_status','resolve_share_token']);
    });
    await t.test('verified owner can still create a numbered draft and publish through the audited RPC only', async () => {
      let draft;
      try {
        await as('authenticated',ids.owner,async () => {
          draft=(await one(`INSERT INTO public.listings(agent_id,address,city,state,zip_code,county,price,status,
            draft_intended_status,listing_type,property_type,listing_agreement_types,buyer_agent_compensation_offered,photos)
            VALUES($1,'789 Privacy Draft Fixture','Testville','MA','00000','Suffolk',500000,'draft','active',
              'for_sale','single_family','["Exclusive Right To Sell"]',false,
              '[{"url":"https://kwfqjnepesiihjkdnxou.supabase.co/storage/v1/object/public/listing-photos/fake/one.png"}]')
            RETURNING id,listing_number`,[ids.owner]));
          assert.ok(draft.listing_number);
          await assert.rejects(db.query(`UPDATE public.listings SET status='active' WHERE id=$1`,[draft.id]),/publish_listing/);
          const published=(await one('SELECT public.publish_listing($1,gen_random_uuid()) result',[draft.id])).result;
          assert.equal(published.ok,true,JSON.stringify(published));
          assert.equal((await one('SELECT external_sharing_allowed FROM public.listings WHERE id=$1',[draft.id])).external_sharing_allowed,false);
        });
        assert.equal((await one(`SELECT count(*)::int n FROM public.listing_publish_audit WHERE listing_id=$1 AND outcome='succeeded'`,[draft.id])).n,1);
        assert.equal((await one('SELECT public.migration_no_contact_status() result')).result.database_locked,true);
      } finally { if(draft?.id) await db.query('DELETE FROM public.listings WHERE id=$1',[draft.id]); }
    });
    await t.test('future tables, sequences and functions do not regain anonymous default grants', async () => {
      await db.exec(`CREATE TABLE public.privacy_future_probe(id bigint GENERATED BY DEFAULT AS IDENTITY);
        CREATE FUNCTION public.privacy_future_probe_fn() RETURNS int LANGUAGE sql AS $$SELECT 1$$;`);
      assert.equal((await one(`SELECT has_any_column_privilege('anon','public.privacy_future_probe','SELECT') allowed`)).allowed,false);
      assert.equal((await one(`SELECT has_function_privilege('anon','public.privacy_future_probe_fn()','EXECUTE') allowed`)).allowed,false);
      assert.equal((await one(`SELECT has_sequence_privilege('anon','public.privacy_future_probe_id_seq','USAGE') allowed`)).allowed,false);
      await db.exec('DROP TABLE public.privacy_future_probe; DROP FUNCTION public.privacy_future_probe_fn();');
    });
    await t.test('workspace-only invitations retain recipient validation and accept without attaching a Hot Sheet', async () => {
      const crm = '00000000-0000-4000-8000-000000000201';
      const raw = 'fake-workspace-only-invite-1234567890';
      await db.exec('SET session_replication_role=replica;');
      await db.query(`INSERT INTO public.clients(id,agent_id,first_name,last_name,email) VALUES($1,$2,'Buyer','Fixture','buyer@example.invalid')`, [crm,ids.sharer]);
      const payload = { type:'client_hotsheet_invite', invite_only:true, suppress_initial_matches:true, client_id:crm, client_email:'buyer@example.invalid' };
      await db.query(`INSERT INTO public.share_tokens(token,agent_id,payload,expires_at) VALUES($1,$2,$3,now()+interval '1 day')`, [raw,ids.sharer,payload]);
      await db.query(`INSERT INTO public.share_tokens(token,agent_id,payload) VALUES('fake-wrong-owner-workspace-1234567890',$1,$2)`, [ids.other,payload]);
      await db.exec('SET session_replication_role=origin;');
      const countBefore = (await one('SELECT count(*)::int n FROM public.hot_sheet_clients')).n;
      assert.equal((await as('anon',null,()=>one('SELECT public.resolve_share_token($1) result',[raw]))).result.payload.client_id,crm);
      assert.equal((await one(`SELECT public.resolve_share_token('fake-wrong-owner-workspace-1234567890') result`)).result,null);
      await as('authenticated',ids.other,()=>assert.rejects(db.query('SELECT public.accept_client_hot_sheet_invite($1)',[raw]),/email_mismatch/));
      const accepted = await as('authenticated',ids.buyer,()=>one('SELECT public.accept_client_hot_sheet_invite($1) result',[raw]));
      assert.equal(accepted.result.ok,true);
      assert.equal((await one('SELECT count(*)::int n FROM public.hot_sheet_clients')).n,countBefore);
      await db.query(`UPDATE public.share_tokens SET revoked_at=now() WHERE token=$1`,[raw]);
      assert.equal((await one('SELECT public.resolve_share_token($1) result',[raw])).result,null);
      await db.query(`UPDATE public.share_tokens SET revoked_at=NULL,expires_at=now()-interval '1 day' WHERE token=$1`,[raw]);
      assert.equal((await one('SELECT public.resolve_share_token($1) result',[raw])).result,null);
    });
    await t.test('buyer authorization enforces ZIP, empty status, property codes and overlapping price ranges',async()=>{
      const oldCriteria=(await one('SELECT criteria FROM public.hot_sheets WHERE id=$1',[ids.sheet])).criteria;
      const setCriteria=async criteria=>{
        await db.exec('SET session_replication_role=replica;');
        await db.query('UPDATE public.hot_sheets SET criteria=$1 WHERE id=$2',[criteria,ids.sheet]);
        await db.exec('SET session_replication_role=origin;');
      };
      const count=async criteria=>{
        await setCriteria(criteria);
        const result=await as('anon',null,()=>one(`SELECT public.get_shared_hot_sheet('fake-hot-sheet-token-valid-1234567890') result`));
        return result.result.listings.length;
      };
      try {
        assert.equal(await count({statuses:['active'],zipCode:'99999'}),0);
        assert.equal(await count({statuses:[]}),0);
        assert.equal(await count({statuses:['active'],zipCode:'000'}),1);
        assert.equal(await count({statuses:['active'],listingType:'for_rent'}),0);
        await db.exec('SET session_replication_role=replica;');
        await db.query(`UPDATE public.listings SET property_type='single_family',price=0,price_range_min=650000,price_range_max=750000,neighborhood='Back Bay' WHERE id=$1`,[ids.listing]);
        await db.exec('SET session_replication_role=origin;');
        assert.equal(await count({statuses:['active'],minPrice:600000,maxPrice:800000,propertyTypes:['single_family']}),1);
        assert.equal(await count({statuses:['active'],minPrice:750001,maxPrice:800000}),0);
        assert.equal(await count({statuses:['active'],maxPrice:650000}),1);
        assert.equal(await count({statuses:['active'],cities:['Testville-Back Bay']}),1);
        assert.equal(await count({statuses:['active'],cities:['Other City-Back Bay']}),0);
        const criteria={statuses:['active'],neighborhoods:['Testville-Back Bay'],listingType:'for_sale',listingNumber:'AAC'};
        await setCriteria(criteria);
        const shared=(await as('anon',null,()=>one(`SELECT public.get_shared_hot_sheet('fake-hot-sheet-token-valid-1234567890') result`))).result;
        assert.deepEqual(shared.hot_sheet.criteria,criteria);
        await setCriteria({statuses:['active'],zipCode:'99999'});
        await as('authenticated',ids.buyer,async()=>{
          assert.equal((await one('SELECT public.get_buyer_listing($1,$2) result',[ids.listing,ids.sheet])).result,null);
          assert.equal((await one('SELECT public.get_shared_listing_photo_paths(NULL,$1,$2) result',[ids.listing,ids.sheet])).result,null);
        });
      } finally {
        await db.exec('SET session_replication_role=replica;');
        await db.query('UPDATE public.listings SET price=500000,price_range_min=NULL,price_range_max=NULL WHERE id=$1',[ids.listing]);
        await db.exec('SET session_replication_role=origin;'); await setCriteria(oldCriteria);
      }
    });
    await t.test('restored member detail retains safe property sections and the actual sharing agent',async()=>{
      await db.exec('SET session_replication_role=replica;');
      await db.query(`UPDATE public.listings SET year_built=2000,property_features='["Fireplace"]',garage_spaces=2,documents='[{"url":"PRIVATE-DOCUMENT"}]' WHERE id=$1`,[ids.listing]);
      await db.exec('SET session_replication_role=origin;');
      const {result}=await as('authenticated',ids.buyer,()=>one('SELECT public.get_buyer_listing($1,$2) result',[ids.listing,ids.sheet]));
      assert.equal(result.agent.id,ids.sharer); assert.equal(result.listing.year_built,2000); assert.equal(result.listing.garage_spaces,2);
      assert.deepEqual(result.listing.property_features,['Fireplace']);
      for(const field of ['agent_id','broker_comments','lockbox_code','documents']) assert.equal(field in result.listing,false);
      for(const secret of ['PRIVATE-DOCUMENT','PRIVATE-LOCKBOX','PRIVATE-BROKER','owner@example.invalid','storage/v1/object/public']) assert.equal(JSON.stringify(result).includes(secret),false);
    });
    await t.test('DCMLS public rows, profiles and media require consent, publication and participation on every read',async()=>{
      const patch=async(listing={},settings={})=>{
        await db.exec('SET session_replication_role=replica;');
        for(const [field,value] of Object.entries(listing)) await db.query(`UPDATE public.listings SET ${field}=$1 WHERE id=$2`,[value,ids.listing]);
        for(const [field,value] of Object.entries(settings)) await db.query(`UPDATE public.agent_settings SET ${field}=$1 WHERE user_id=$2`,[value,ids.owner]);
        await db.exec('SET session_replication_role=origin;');
      };
      const publicCount=()=>as('anon',null,()=>one('SELECT count(*)::int n FROM public.dcmls_listings_public'));
      assert.equal((await publicCount()).n,0);
      const published={publish_to_dcmls:true,dcmls_status:'published',status:'active',external_sharing_allowed:true};
      const participating={dcmls_participation:true,hide_from_directory:false,agent_status:'verified'};
      try {
        await patch(published,participating);
        assert.equal((await publicCount()).n,1);
        await as('anon',null,async()=>{
          const row=await one('SELECT * FROM public.get_dcmls_listing($1)',[ids.listing]);
          assert.match(row.photos[0].url,/^aac-private:/);
          assert.equal('broker_comments' in row,false);
          assert.equal((await one('SELECT public.get_dcmls_listing_agent($1) result',[ids.listing])).result.agent_id,ids.owner);
          assert.equal((await one('SELECT public.get_dcmls_agent_profile($1) result',[ids.owner])).result.id,ids.owner);
          assert.equal((await one('SELECT public.get_dcmls_agent_profile($1) result',[ids.other])).result,null);
          assert.equal((await one('SELECT public.get_dcmls_listing_agent($1) result',[ids.second])).result,null);
          await assert.rejects(db.query('SELECT * FROM public.listings'),/permission denied/);
          await assert.rejects(db.query('SELECT public.get_public_listing($1)',[ids.listing]),/permission denied/);
          await assert.rejects(db.query('SELECT public.get_dcmls_listing_photo_paths($1)',[ids.listing]),/permission denied/);
        });
        assert.ok((await as('service_role',null,()=>one('SELECT public.get_dcmls_listing_photo_paths($1) result',[ids.listing]))).result);
        for(const [listing,settings] of [
          [{publish_to_dcmls:false},{}],[{dcmls_status:'hidden'},{}],[{status:'withdrawn'},{}],
          [{external_sharing_allowed:false},{}],[{},{dcmls_participation:false}],[{},{hide_from_directory:true}],[{},{agent_status:'pending'}],
        ]) {
          await patch({...published,...listing},{...participating,...settings});
          assert.equal((await publicCount()).n,0);
          assert.equal((await as('anon',null,()=>one('SELECT public.get_dcmls_listing_agent($1) result',[ids.listing]))).result,null);
          assert.equal((await as('anon',null,()=>one('SELECT public.get_dcmls_agent_profile($1) result',[ids.owner]))).result,null);
          assert.equal((await as('service_role',null,()=>one('SELECT public.get_dcmls_listing_photo_paths($1) result',[ids.listing]))).result,null);
        }
      } finally { await patch({...published,publish_to_dcmls:false},{...participating,dcmls_participation:false}); }
      const status=(await one('SELECT public.migration_no_contact_status() result')).result;
      assert.equal(status.database_locked,true); assert.equal(status.changed_quarantined_routines,0);
    });
    await t.test('read-only post-cutover verifier and fail-closed external recovery execute against the actual schema', async () => {
      await db.exec(`INSERT INTO storage.buckets(id,name,public) VALUES
        ('listing-floorplans','listing-floorplans',false),('agent-match-photos','agent-match-photos',false),('email-attachments','email-attachments',false)`);
      await db.exec(await read('docs/privacy-lockdown/verify-in-migration.sql'));
      const fresh = await as('authenticated', ids.sharer, async () => (await one('SELECT public.create_listing_share_link($1) token',[ids.listing])).token);
      assert.ok((await one('SELECT public.get_shared_listing($1) result',[fresh])).result);
      await db.exec(await read('docs/privacy-lockdown/emergency-disable-external.sql'));
      assert.equal((await one('SELECT public.get_shared_listing($1) result',[fresh])).result,null);
      await as('authenticated',ids.sharer,async () => assert.equal((await one('SELECT count(*)::int n FROM public.listings_public')).n,2));
      await db.exec(runner);
      assert.ok((await one('SELECT public.get_shared_listing($1) result',[fresh])).result);
      assert.equal((await one('SELECT public.migration_no_contact_status() result')).result.database_locked,true);
    });
    if (process.env.PRIVACY_ACCESS_REPORT) {
      const rows = (await db.query(`SELECT p.oid::regprocedure::text signature, p.prosecdef elevated,
        p.prorettype='trigger'::regtype trigger_function,
        has_function_privilege('anon',p.oid,'EXECUTE') anonymous,
        has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,
        has_function_privilege('service_role',p.oid,'EXECUTE') service
        FROM pg_proc p WHERE p.pronamespace='public'::regnamespace ORDER BY signature`)).rows;
      const out = ['# Database Function Access', '',
        'Effective execution permissions after the privacy lockdown, workflow repair and access boundary migrations. Inherited PUBLIC grants are included. Trigger functions cannot be called as ordinary RPCs. Authenticated access remains subject to caller authorization, ownership checks and RLS.', '',
        '| Function | Security definer | Trigger | Anonymous | Authenticated | Service |', '|---|---|---|---|---|---|'];
      for (const row of rows) out.push(`| \`${row.signature}\` | ${row.elevated} | ${row.trigger_function} | ${row.anonymous} | ${row.authenticated} | ${row.service} |`);
      await writeFile(process.env.PRIVACY_ACCESS_REPORT, out.join('\n') + '\n');
    }
  } finally { await db.close(); }
});
