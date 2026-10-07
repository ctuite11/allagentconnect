-- LOCKED duplicate-email rule verification. Runs entirely inside one block and
-- always raises at the end, so every change rolls back. Expected output:
-- new: created=t | case-variant: same_id=t created=f | repeat: same_id=t created=f | rows=1
-- | other-member: This email is associated with another member and cannot be added.
-- Uses the AAC test agent account; change `agent` to run as another agent.
DO $$
DECLARE r1 record; r2 record; r3 record; n int; other text; msg text := ''; blocked text;
  agent uuid := '1fc50da1-2664-4931-8cab-64e24dc5ed8c';
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', agent, 'role', 'authenticated')::text, true);
  SELECT * INTO r1 FROM public.resolve_or_create_agent_contact('zz.regtest+1@example.com','Reg','Test');
  SELECT * INTO r2 FROM public.resolve_or_create_agent_contact('  ZZ.RegTest+1@Example.COM ','Reg','Test');
  SELECT * INTO r3 FROM public.resolve_or_create_agent_contact('zz.regtest+1@example.com','Reg','Test');
  SELECT count(*) INTO n FROM public.clients WHERE agent_id = agent AND lower(email) = 'zz.regtest+1@example.com';
  msg := format('new: created=%s | case-variant: same_id=%s created=%s | repeat: same_id=%s created=%s | rows=%s',
    r1.created, r2.contact_id = r1.contact_id, r2.created, r3.contact_id = r1.contact_id, r3.created, n);
  SELECT email INTO other FROM public.profiles WHERE id <> agent AND email IS NOT NULL
    AND lower(email) NOT IN (SELECT lower(email) FROM public.clients WHERE agent_id = agent AND email IS NOT NULL) LIMIT 1;
  BEGIN
    PERFORM public.resolve_or_create_agent_contact(upper(other),'X','Y');
    blocked := 'NOT BLOCKED';
  EXCEPTION WHEN OTHERS THEN blocked := SQLERRM; END;
  RAISE EXCEPTION 'ROLLBACK_RESULT % | other-member: %', msg, blocked;
END $$;
