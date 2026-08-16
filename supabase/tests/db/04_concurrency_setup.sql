-- Committed fixture for the two-session concurrency test (disposable cluster).
INSERT INTO public.listings(id, status, state, county, city, property_type, price, agent_id)
VALUES ('11111111-1111-1111-1111-111111111111','active','MA','Suffolk','Boston','single_family',400000, gen_random_uuid());
INSERT INTO public.hot_sheets(id, name, criteria, is_active)
VALUES ('22222222-2222-2222-2222-222222222222','Concurrency','{"cities":["Boston"]}'::jsonb, true);
INSERT INTO public.hot_sheet_listing_events(id, listing_id, trigger_op, old_status, new_status, dedupe_key, state)
VALUES ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','UPDATE','draft','active','dk-a','pending'),
       ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','UPDATE','new','active','dk-b','pending');
