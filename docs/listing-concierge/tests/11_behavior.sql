-- Each check prints PASS or raises. FAKE DATA ONLY.
\set ON_ERROR_STOP 1
CREATE FUNCTION pg_temp.ok(c boolean, name text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN IF NOT c THEN RAISE EXCEPTION 'FAIL: %', name; END IF; RAISE NOTICE 'PASS: %', name; END $$;
CREATE FUNCTION pg_temp.denied(sql text, who text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('test.uid', who, false); EXECUTE sql; RETURN false;
EXCEPTION WHEN OTHERS THEN RETURN true; END $$;

-- Candidates
SELECT pg_temp.ok((SELECT array_agg(address ORDER BY address) FROM listing_reminder_candidates(50))
  = ARRAY['1 Old St','4 Ben St'], '01 only never-updated 30+ day non-draft listings; unsubscribed agent excluded');
-- Claim once per 30 days (duplicate prevention, incl. two systems racing)
SELECT pg_temp.ok(claim_listing_reminder('10000000-0000-0000-0000-000000000001'), '02 first claim succeeds');
SELECT pg_temp.ok(NOT claim_listing_reminder('10000000-0000-0000-0000-000000000001'), '03 second claim same week refused');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM listing_reminder_candidates(50) WHERE address='1 Old St'), '04 claimed listing not re-selected by weekly run');
UPDATE listing_reminder_log SET last_sent_at = now()-interval '31 days';
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM listing_reminder_candidates(50) WHERE address='1 Old St'), '05 eligible again after 30 days if still untouched');

-- Meaningful changes stop reminders
UPDATE listings SET photos='["x.jpg"]' WHERE id='10000000-0000-0000-0000-000000000004';
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM listing_reminder_candidates(50) WHERE address='4 Ben St'), '06 photo change counts as update');
UPDATE listings SET agent_last_touched_at=NULL WHERE id='10000000-0000-0000-0000-000000000004';
UPDATE listings SET updated_at=now() WHERE id='10000000-0000-0000-0000-000000000004';
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM listing_reminder_candidates(50) WHERE address='4 Ben St'), '07 non-meaningful touch does not count');

-- One-click confirm
SELECT pg_temp.ok(pg_temp.denied($$SELECT confirm_listing_current('10000000-0000-0000-0000-000000000001')$$,'00000000-0000-0000-0000-00000000000b'), '08 other agent cannot confirm');
SELECT pg_temp.ok(pg_temp.denied($$SELECT confirm_listing_current('10000000-0000-0000-0000-000000000001')$$,''), '09 signed-out cannot confirm');
SELECT pg_temp.ok(pg_temp.denied($$SELECT confirm_listing_current('10000000-0000-0000-0000-000000000001')$$,'00000000-0000-0000-0000-0000000000ff'), '10 staff cannot confirm on agent''s behalf');
SELECT set_config('test.uid','00000000-0000-0000-0000-00000000000a',false);
SELECT confirm_listing_current('10000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM listing_reminder_candidates(50) WHERE address='1 Old St'), '11 "still accurate" stops reminders');

-- Concierge: Sold
SELECT pg_temp.ok(pg_temp.denied($$SELECT submit_concierge_request('10000000-0000-0000-0000-000000000001','sold')$$,'00000000-0000-0000-0000-00000000000a'), '12 Sold without closing date/price/fee rejected');
SELECT pg_temp.ok(pg_temp.denied($$SELECT submit_concierge_request('10000000-0000-0000-0000-000000000001','sold',NULL,'2026-10-15',512000,'percent',NULL)$$,'00000000-0000-0000-0000-00000000000a'), '13 percent fee without a value rejected');
SELECT pg_temp.ok(pg_temp.denied($$SELECT submit_concierge_request('10000000-0000-0000-0000-000000000001','sold',NULL,'2026-10-15',512000,'none',5000)$$,'00000000-0000-0000-0000-00000000000a'), '14 "no fee paid" with an amount rejected');
SELECT pg_temp.ok(pg_temp.denied($$SELECT submit_concierge_request('10000000-0000-0000-0000-000000000001','price_change',450000)$$,'00000000-0000-0000-0000-00000000000b'), '15 other agent cannot submit');
SELECT set_config('test.uid','00000000-0000-0000-0000-00000000000d',false);
SELECT submit_concierge_request('10000000-0000-0000-0000-000000000001','sold',NULL,'2026-10-15',512000,'percent',2.5,'Closed last month') AS rid \gset
SELECT pg_temp.ok((SELECT closing_date='2026-10-15' AND final_sale_price=512000 AND buyer_fee_paid_type='percent' AND buyer_fee_paid_value=2.5 FROM listing_concierge_requests WHERE id=:'rid'), '16 delegate submits Sold; date, price and fee paid stored');

-- Staff proposes; live listing untouched
SELECT pg_temp.ok(pg_temp.denied(format($$SELECT admin_propose_concierge_changes(%L,'{"status":"sold"}')$$, :'rid'),'00000000-0000-0000-0000-00000000000a'), '17 agent cannot use staff proposal');
SELECT pg_temp.ok(pg_temp.denied(format($$SELECT admin_propose_concierge_changes(%L,'{"agent_id":"x"}')$$, :'rid'),'00000000-0000-0000-0000-0000000000ff'), '18 staff cannot propose disallowed fields');
SELECT set_config('test.uid','00000000-0000-0000-0000-0000000000ff',false);
SELECT admin_propose_concierge_changes(:'rid','{"status":"sold"}');
SELECT pg_temp.ok((SELECT status='active' FROM listings WHERE id='10000000-0000-0000-0000-000000000001'), '19 published listing unchanged until agent approves');
SELECT pg_temp.ok(pg_temp.denied(format($$SELECT approve_concierge_request(%L)$$, :'rid'),'00000000-0000-0000-0000-0000000000ff'), '20 staff cannot publish');
SELECT pg_temp.ok(pg_temp.denied(format($$SELECT approve_concierge_request(%L)$$, :'rid'),'00000000-0000-0000-0000-00000000000b'), '21 other agent cannot publish');
SELECT pg_temp.ok(pg_temp.denied(format($$SELECT approve_concierge_request(%L)$$, :'rid'),''), '22 signed-out cannot publish');

-- Agent approves
SELECT set_config('test.uid','00000000-0000-0000-0000-00000000000a',false);
SELECT approve_concierge_request(:'rid');
SELECT pg_temp.ok((SELECT status='sold' FROM listings WHERE id='10000000-0000-0000-0000-000000000001'), '23 agent approval publishes Sold (leaves active matching)');
SELECT pg_temp.ok((SELECT count(*)=1 FROM listing_sale_records WHERE request_id=:'rid' AND buyer_fee_paid_value=2.5), '24 sale record kept with fee actually paid');
SELECT pg_temp.ok((SELECT array_agg(event ORDER BY id)=ARRAY['submitted','proposed','published'] FROM listing_concierge_events WHERE request_id=:'rid'), '25 full history recorded');
SELECT pg_temp.ok(pg_temp.denied(format($$SELECT approve_concierge_request(%L)$$, :'rid'),'00000000-0000-0000-0000-00000000000a'), '26 cannot publish twice');

-- Reads are scoped (RLS)
SET ROLE authenticated;
SELECT set_config('test.uid','00000000-0000-0000-0000-00000000000b',false);
SELECT pg_temp.ok((SELECT count(*) FROM listing_concierge_requests)=0, '27 other agent sees no requests');
SELECT set_config('test.uid','00000000-0000-0000-0000-0000000000ff',false);
SELECT pg_temp.ok((SELECT count(*) FROM listing_concierge_requests)=1, '28 staff sees the queue');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.ok(pg_temp.denied('SELECT 1 FROM public.listing_concierge_requests',''), '29 signed-out cannot read requests');
RESET ROLE;
