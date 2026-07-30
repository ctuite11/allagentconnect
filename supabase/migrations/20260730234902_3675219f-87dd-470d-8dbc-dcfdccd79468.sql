
DO $$
DECLARE v_user uuid; blocked boolean := false; msg text;
BEGIN
  SELECT user_id INTO v_user FROM public.agent_settings WHERE agent_status = 'pending' LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text, 'role','authenticated')::text, true);
  BEGIN
    UPDATE public.agent_settings
      SET agent_status='verified', verified_at=now(), account_activated_at=now()
      WHERE user_id = v_user;
  EXCEPTION WHEN others THEN
    blocked := true; msg := SQLERRM;
  END;
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF NOT blocked THEN
    RAISE EXCEPTION 'GUARD TEST FAILED: normal agent was able to self-verify';
  END IF;
  RAISE NOTICE 'GUARD TEST PASSED: %', msg;
END $$;
