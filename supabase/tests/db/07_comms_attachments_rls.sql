-- Comms Center broadcast attachments: RLS security assertions.
-- Proves a sender cannot write/delete another sender's attachment rows and
-- that anonymous users cannot read them. Rolls back; sends nothing.
BEGIN;

\set alice '11111111-1111-1111-1111-111111111111'
\set bob   '22222222-2222-2222-2222-222222222222'

INSERT INTO public.comms_broadcasts (id, sender_id)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', :'alice');

-- Alice attaches to her own broadcast: allowed.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
INSERT INTO public.comms_broadcast_attachments (broadcast_id, sender_id, path, kind)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', :'alice', '11111111-1111-1111-1111-111111111111/a.jpg', 'image');
SELECT 'alice_insert_ok' AS assertion, count(*) = 1 AS passed
FROM public.comms_broadcast_attachments;

-- Bob cannot insert a row claiming Alice as sender.
SET LOCAL request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
DO $$
BEGIN
  INSERT INTO public.comms_broadcast_attachments (broadcast_id, sender_id, path, kind)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111/b.jpg', 'image');
  RAISE EXCEPTION 'FAIL: bob inserted a row as alice';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: bob_insert_as_alice_denied';
END $$;

-- Bob cannot delete Alice's attachment (0 rows affected under RLS).
WITH d AS (
  DELETE FROM public.comms_broadcast_attachments
  WHERE path = '11111111-1111-1111-1111-111111111111/a.jpg'
  RETURNING 1
)
SELECT 'bob_delete_denied' AS assertion, count(*) = 0 AS passed FROM d;

-- Bob (authenticated agent) can read the network-wide feed.
SELECT 'authenticated_read_ok' AS assertion, count(*) = 1 AS passed
FROM public.comms_broadcast_attachments;

-- Anonymous users get nothing.
SET LOCAL ROLE anon;
SELECT 'anon_read_denied' AS assertion, count(*) = 0 AS passed
FROM public.comms_broadcast_attachments;

RESET ROLE;
ROLLBACK;
