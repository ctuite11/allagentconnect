-- Step 3A: stamp account_activated_at for two proven activation-token redemptions.
-- Patricia Burns  b01352e3-1cef-4289-8927-e2cecb666803 -> 2026-08-01 21:01:34.187814+00
-- Maria Renda     7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca -> 2026-08-03 09:46:57.472291+00
DO $$
DECLARE
  v_ready int;
  v_updated int;
  v_baseline int;
BEGIN
  SELECT count(*) INTO v_ready
  FROM public.agent_settings s
  JOIN public.agent_activation_tokens t ON t.user_id = s.user_id
  WHERE s.user_id IN ('b01352e3-1cef-4289-8927-e2cecb666803','7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca')
    AND s.agent_status = 'verified'
    AND s.account_activated_at IS NULL
    AND t.redeemed_at IS NOT NULL
    AND ((s.user_id = 'b01352e3-1cef-4289-8927-e2cecb666803' AND t.redeemed_at = '2026-08-01 21:01:34.187814+00'::timestamptz)
      OR (s.user_id = '7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca' AND t.redeemed_at = '2026-08-03 09:46:57.472291+00'::timestamptz));

  IF v_ready <> 2 THEN
    RAISE EXCEPTION 'Step 3A precondition failed: expected 2 ready rows, found %', v_ready;
  END IF;

  SELECT count(*) INTO v_baseline FROM public.agent_settings WHERE account_activated_at IS NOT NULL;

  UPDATE public.agent_settings s
  SET account_activated_at = t.redeemed_at,
      updated_at = now()
  FROM public.agent_activation_tokens t
  WHERE t.user_id = s.user_id
    AND s.user_id IN ('b01352e3-1cef-4289-8927-e2cecb666803','7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca')
    AND s.agent_status = 'verified'
    AND s.account_activated_at IS NULL
    AND ((s.user_id = 'b01352e3-1cef-4289-8927-e2cecb666803' AND t.redeemed_at = '2026-08-01 21:01:34.187814+00'::timestamptz)
      OR (s.user_id = '7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca' AND t.redeemed_at = '2026-08-03 09:46:57.472291+00'::timestamptz));

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 2 THEN
    RAISE EXCEPTION 'Step 3A: expected 2 updated rows, got %', v_updated;
  END IF;

  IF (SELECT count(*) FROM public.agent_settings WHERE account_activated_at IS NOT NULL) <> v_baseline + 2 THEN
    RAISE EXCEPTION 'Step 3A: collateral activation changes detected';
  END IF;

  IF (SELECT count(*) FROM public.agent_settings s
      WHERE s.user_id IN ('b01352e3-1cef-4289-8927-e2cecb666803','7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca')
        AND s.account_activated_at IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'Step 3A: target stamps missing';
  END IF;

  IF (SELECT count(*) FROM public.get_verified_agent_ids() g
      WHERE g::text IN ('b01352e3-1cef-4289-8927-e2cecb666803','7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca')) <> 2 THEN
    RAISE EXCEPTION 'Step 3A: targets not present in get_verified_agent_ids()';
  END IF;
END $$;