-- LOCKED duplicate-email rule verification. Runs entirely inside one block and
-- always raises at the end, so every change rolls back. Expected output:
-- new: created=t | case-variant: same_id=t created=f | repeat: same_id=t created=f | rows=1
-- | hidden: created=t hidden=t | hidden-reuse: same_id=t still_hidden=t | promote: same_id=t hidden=f rows=1
-- | no-demote: hidden=f | other-member: This email is associated with another member and cannot be added.
-- | other-member-hidden: This email is associated with another member and cannot be added.
-- Uses the AAC test agent account; change `agent` to run as another agent.
DO $$
DECLARE r1 record; r2 record; r3 record; h1 record; h2 record; h3 record; n int; hn int;
  other text; msg text := ''; blocked text; blocked_h text; hid boolean; hid2 boolean; hid3 boolean; hid4 boolean;
  agent uuid := '1fc50da1-2664-4931-8cab-64e24dc5ed8c';
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', agent, 'role', 'authenticated')::text, true);
  SELECT * INTO r1 FROM public.resolve_or_create_agent_contact('zz.regtest+1@example.com','Reg','Test');
  SELECT * INTO r2 FROM public.resolve_or_create_agent_contact('  ZZ.RegTest+1@Example.COM ','Reg','Test');
  SELECT * INTO r3 FROM public.resolve_or_create_agent_contact('zz.regtest+1@example.com','Reg','Test');
  SELECT count(*) INTO n FROM public.clients WHERE agent_id = agent AND lower(email) = 'zz.regtest+1@example.com';
  msg := format('new: created=%s | case-variant: same_id=%s created=%s | repeat: same_id=%s created=%s | rows=%s',
    r1.created, r2.contact_id = r1.contact_id, r2.created, r3.contact_id = r1.contact_id, r3.created, n);

  -- Hot-Sheet-only ("No") contact: hidden create, hidden reuse, explicit-save promotion.
  SELECT * INTO h1 FROM public.resolve_or_create_agent_contact('zz.regtest+hidden@example.com','Hid','Den', p_hidden => true);
  SELECT hidden_from_contacts INTO hid FROM public.clients WHERE id = h1.contact_id;
  SELECT * INTO h2 FROM public.resolve_or_create_agent_contact('zz.regtest+hidden@example.com','Hid','Den', p_hidden => true);
  SELECT hidden_from_contacts INTO hid2 FROM public.clients WHERE id = h1.contact_id;
  SELECT * INTO h3 FROM public.resolve_or_create_agent_contact('zz.regtest+hidden@example.com','Hid','Den');
  SELECT hidden_from_contacts INTO hid3 FROM public.clients WHERE id = h1.contact_id;
  SELECT count(*) INTO hn FROM public.clients WHERE agent_id = agent AND lower(email) = 'zz.regtest+hidden@example.com';
  -- A visible contact is never demoted by a later "No".
  PERFORM public.resolve_or_create_agent_contact('zz.regtest+1@example.com','Reg','Test', p_hidden => true);
  SELECT hidden_from_contacts INTO hid4 FROM public.clients WHERE id = r1.contact_id;
  msg := msg || format(' | hidden: created=%s hidden=%s | hidden-reuse: same_id=%s still_hidden=%s | promote: same_id=%s hidden=%s rows=%s | no-demote: hidden=%s',
    h1.created, hid, h2.contact_id = h1.contact_id, hid2, h3.contact_id = h1.contact_id, hid3, hn, hid4);

  SELECT email INTO other FROM public.profiles WHERE id <> agent AND email IS NOT NULL
    AND lower(email) NOT IN (SELECT lower(email) FROM public.clients WHERE agent_id = agent AND email IS NOT NULL) LIMIT 1;
  BEGIN
    PERFORM public.resolve_or_create_agent_contact(upper(other),'X','Y');
    blocked := 'NOT BLOCKED';
  EXCEPTION WHEN OTHERS THEN blocked := SQLERRM; END;
  BEGIN
    PERFORM public.resolve_or_create_agent_contact(other,'X','Y', p_hidden => true);
    blocked_h := 'NOT BLOCKED';
  EXCEPTION WHEN OTHERS THEN blocked_h := SQLERRM; END;
  RAISE EXCEPTION 'ROLLBACK_RESULT % | other-member: % | other-member-hidden: %', msg, blocked, blocked_h;
END $$;
