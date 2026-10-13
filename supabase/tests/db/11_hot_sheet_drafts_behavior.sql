-- Behavioural tests for Hot Sheet drafts + finalize_hot_sheet. Runs in a
-- disposable cluster only (scripts/run-hot-sheet-draft-tests.sh).
\set ON_ERROR_STOP 1
BEGIN;
SELECT set_config('test.uid', '11111111-1111-1111-1111-111111111111', true);
INSERT INTO public.profiles VALUES ('11111111-1111-1111-1111-111111111111');
INSERT INTO public.clients (id, agent_id, email) VALUES
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'b1@example.com'),
  ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'b2@example.com');

DO $$
DECLARE d uuid; d2 uuid; r record; n int; v uuid;
BEGIN
  -- 1. Completely empty draft (no name, type, criteria, location, contact) is accepted.
  INSERT INTO hot_sheets (user_id, name, criteria, is_draft, is_active, sheet_type)
  VALUES ('11111111-1111-1111-1111-111111111111', '', '{}', true, true, NULL) RETURNING id INTO d;
  SELECT * INTO r FROM hot_sheets WHERE id = d;
  ASSERT r.is_active = false, '1: draft must be forced inactive';
  ASSERT r.sheet_type IS NULL, '1: sheet_type must stay blank, never defaulted to buyer';
  RAISE NOTICE 'PASS 1 empty draft saved, inactive, type blank';

  -- 2. Draft with criteria/state never creates a Communications buyer need.
  UPDATE hot_sheets SET name = 'Back Bay', criteria = '{"state":"MA","cities":["Boston"]}' WHERE id = d;
  SELECT count(*) INTO n FROM client_needs; ASSERT n = 0, '2: draft created a buyer need';
  RAISE NOTICE 'PASS 2 draft autosave creates no buyer need';

  -- 3. Draft cannot get contacts or recipient batches, and cannot be made active directly.
  BEGIN INSERT INTO hot_sheet_clients (hot_sheet_id, client_id) VALUES (d, 'c0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'X3a'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'X3a' THEN RAISE; END IF; END;
  BEGIN INSERT INTO hot_sheet_recipient_batches (hot_sheet_id) VALUES (d);
    RAISE EXCEPTION 'X3b'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'X3b' THEN RAISE; END IF; END;
  UPDATE hot_sheets SET is_active = true WHERE id = d;
  ASSERT (SELECT NOT is_active FROM hot_sheets WHERE id = d), '3: draft became active';
  BEGIN UPDATE hot_sheets SET is_draft = false WHERE id = d;
    RAISE EXCEPTION 'X3c'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'X3c' THEN RAISE; END IF; END;
  RAISE NOTICE 'PASS 3 drafts refuse contacts, batches, activation and direct un-drafting';

  -- 4. Atomic failure: an invalid contact ID rolls back everything; draft stays intact and inactive.
  BEGIN
    PERFORM finalize_hot_sheet(d, '11111111-1111-1111-1111-111111111111', 'Back Bay', '{"state":"MA"}', 'buyer',
      ARRAY['c0000000-0000-0000-0000-000000000001','deadbeef-0000-0000-0000-000000000000']::uuid[]);
    RAISE EXCEPTION 'X4';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  SELECT * INTO r FROM hot_sheets WHERE id = d;
  ASSERT r.is_draft AND NOT r.is_active, '4: failed finish changed the draft';
  SELECT count(*) INTO n FROM hot_sheet_clients WHERE hot_sheet_id = d; ASSERT n = 0, '4: partial contact links left behind';
  SELECT count(*) INTO n FROM client_needs; ASSERT n = 0, '4: failed finish created a buyer need';
  RAISE NOTICE 'PASS 4 failed finish leaves draft intact and inactive';

  -- 5. Validation: name and type required to finish; personal cannot carry contacts.
  BEGIN PERFORM finalize_hot_sheet(d, '11111111-1111-1111-1111-111111111111', '  ', '{}', 'buyer');
    RAISE EXCEPTION 'X5a'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'X5a' THEN RAISE; END IF; END;
  BEGIN PERFORM finalize_hot_sheet(d, '11111111-1111-1111-1111-111111111111', 'x', '{}', NULL);
    RAISE EXCEPTION 'X5b'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'X5b' THEN RAISE; END IF; END;
  BEGIN PERFORM finalize_hot_sheet(d, '11111111-1111-1111-1111-111111111111', 'x', '{}', 'personal', ARRAY['c0000000-0000-0000-0000-000000000001']::uuid[]);
    RAISE EXCEPTION 'X5c'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'X5c' THEN RAISE; END IF; END;
  ASSERT (SELECT is_draft FROM hot_sheets WHERE id = d), '5: validation failure changed draft';
  RAISE NOTICE 'PASS 5 finish validation';

  -- 6. Successful buyer finish: same row, active, contacts linked, buyer-need sync runs once (normal rule).
  v := finalize_hot_sheet(d, '11111111-1111-1111-1111-111111111111', 'Back Bay', '{"state":"MA","cities":["Boston"]}', 'buyer',
    ARRAY['c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002']::uuid[], NULL, true, true, 'immediately');
  ASSERT v = d, '6: finish created a different row';
  SELECT * INTO r FROM hot_sheets WHERE id = d;
  ASSERT NOT r.is_draft AND r.is_active AND r.draft_state IS NULL AND r.sheet_type = 'buyer', '6: not activated correctly';
  SELECT count(*) INTO n FROM hot_sheet_clients WHERE hot_sheet_id = d; ASSERT n = 2, '6: contacts not linked';
  SELECT count(*) INTO n FROM hot_sheets; ASSERT n = 1, '6: duplicate hot sheet';
  SELECT count(*) INTO n FROM client_needs; ASSERT n = 1, '6: completed sheet should follow normal buyer-need sync';
  SELECT count(*) INTO n FROM hot_sheet_recipient_batches; ASSERT n = 0, '6: finish must not create a batch';
  RAISE NOTICE 'PASS 6 buyer finish is atomic on the same row';

  -- 7. Repeat finish (double click / retry) is a no-op.
  v := finalize_hot_sheet(d, '11111111-1111-1111-1111-111111111111', 'Other', '{}', 'personal');
  ASSERT v = d AND (SELECT name FROM hot_sheets WHERE id = d) = 'Back Bay', '7: repeat finish changed data';
  SELECT count(*) INTO n FROM hot_sheet_clients WHERE hot_sheet_id = d; ASSERT n = 2, '7: repeat finish changed contacts';
  RAISE NOTICE 'PASS 7 repeat finish is a no-op';

  -- 8. Personal draft finishes with no contacts; existing active sheet cannot become a draft.
  INSERT INTO hot_sheets (user_id, name, is_draft, sheet_type) VALUES ('11111111-1111-1111-1111-111111111111', '', true, 'personal') RETURNING id INTO d2;
  v := finalize_hot_sheet(d2, '11111111-1111-1111-1111-111111111111', 'Mine', '{"state":"MA"}', 'personal');
  ASSERT (SELECT is_active AND NOT is_draft FROM hot_sheets WHERE id = d2), '8: personal finish failed';
  BEGIN UPDATE hot_sheets SET is_draft = true WHERE id = d2;
    RAISE EXCEPTION 'X8'; EXCEPTION WHEN raise_exception THEN IF SQLERRM = 'X8' THEN RAISE; END IF; END;
  RAISE NOTICE 'PASS 8 personal finish without contacts; active sheets never revert to draft';

  -- 9. Brand-new sheet with no draft goes through the same single step.
  v := finalize_hot_sheet(NULL, '11111111-1111-1111-1111-111111111111', 'Direct', '{"state":"MA"}', 'buyer', ARRAY['c0000000-0000-0000-0000-000000000001']::uuid[]);
  ASSERT (SELECT is_active FROM hot_sheets WHERE id = v), '9: direct create not active';
  RAISE NOTICE 'PASS 9 direct create';

  -- 10. Nothing was queued or dispatched.
  SELECT count(*) INTO n FROM email_jobs; ASSERT n = 0, '10: email queued';
  SELECT count(*) INTO n FROM net.sent_requests; ASSERT n = 0, '10: network dispatch';
  RAISE NOTICE 'PASS 10 zero emails and zero dispatches';
END $$;
ROLLBACK;
