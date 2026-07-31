CREATE TABLE IF NOT EXISTS public._tmp_lifecycle_test_results(id serial primary key, test text, result text);
TRUNCATE public._tmp_lifecycle_test_results;

DO $$
DECLARE
  v_admin uuid; v_verified uuid; v_pending uuid; r timestamptz; msg text;
BEGIN
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role='admin' LIMIT 1;
  SELECT s.user_id INTO v_verified FROM public.agent_settings s JOIN public.user_roles ur ON ur.user_id=s.user_id AND ur.role='agent'
    WHERE s.agent_status='verified' AND s.account_activated_at IS NULL LIMIT 1;
  SELECT s.user_id INTO v_pending FROM public.agent_settings s JOIN public.user_roles ur ON ur.user_id=s.user_id AND ur.role='agent'
    WHERE s.agent_status='pending' AND s.account_activated_at IS NULL LIMIT 1;

  INSERT INTO public._tmp_lifecycle_test_results(test,result)
  VALUES('0_fixtures', format('admin=%s verified=%s pending=%s', v_admin, v_verified, v_pending));

  PERFORM set_config('request.method','POST',true);

  BEGIN
    PERFORM set_config('request.jwt.claims','',true);
    PERFORM public.mark_agent_activated(v_verified);
    INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('1_no_auth_header_rpc','ALLOWED (FAIL)');
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('1_no_auth_header_rpc','BLOCKED: '||msg);
  END;

  BEGIN
    PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
    PERFORM public.mark_agent_activated(v_verified);
    INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('2_anon_key_rpc','ALLOWED (FAIL)');
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('2_anon_key_rpc','BLOCKED: '||msg);
  END;

  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',v_pending)::text, true);
  r := public.mark_agent_activated(v_pending);
  INSERT INTO public._tmp_lifecycle_test_results(test,result)
  VALUES('3_pending_self_activate', CASE WHEN r IS NULL THEN 'BLOCKED' ELSE 'ALLOWED (FAIL)' END);

  r := public.mark_agent_activated(v_verified);
  INSERT INTO public._tmp_lifecycle_test_results(test,result)
  VALUES('4_agent_activates_other', CASE WHEN r IS NULL THEN 'BLOCKED' ELSE 'ALLOWED (FAIL)' END);

  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',v_verified)::text, true);
  r := public.mark_agent_activated(v_verified);
  INSERT INTO public._tmp_lifecycle_test_results(test,result)
  VALUES('5_verified_self_activate', CASE WHEN r IS NOT NULL THEN 'PASS' ELSE 'FAIL' END);
  PERFORM set_config('app.lifecycle_bypass','on',true);
  UPDATE public.agent_settings SET account_activated_at=NULL WHERE user_id=v_verified;
  PERFORM set_config('app.lifecycle_bypass','off',true);

  BEGIN
    PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
    UPDATE public.agent_settings SET agent_status='verified', verified_at=now() WHERE user_id=v_pending;
    INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('6_anon_lifecycle_update','ALLOWED (FAIL)');
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('6_anon_lifecycle_update','BLOCKED: '||msg);
  END;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',v_pending)::text, true);
    UPDATE public.agent_settings SET agent_status='verified', verified_at=now() WHERE user_id=v_pending;
    INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('7_agent_self_verify_update','ALLOWED (FAIL)');
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('7_agent_self_verify_update','BLOCKED: '||msg);
  END;

  BEGIN
    PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
    INSERT INTO public.agent_settings(user_id, agent_status, verified_at, account_activated_at)
    VALUES (gen_random_uuid(),'verified',now(),now());
    INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('8_anon_lifecycle_insert','ALLOWED (FAIL)');
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('8_anon_lifecycle_insert','BLOCKED: '||msg);
  END;

  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',v_admin)::text, true);
  r := public.mark_agent_activated(v_pending);
  INSERT INTO public._tmp_lifecycle_test_results(test,result)
  VALUES('9_admin_activates_agent', CASE WHEN r IS NOT NULL THEN 'PASS' ELSE 'FAIL' END);
  PERFORM set_config('app.lifecycle_bypass','on',true);
  UPDATE public.agent_settings SET account_activated_at=NULL WHERE user_id=v_pending;
  PERFORM set_config('app.lifecycle_bypass','off',true);

  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  r := public.mark_agent_activated(v_pending);
  INSERT INTO public._tmp_lifecycle_test_results(test,result)
  VALUES('10_service_role_activates', CASE WHEN r IS NOT NULL THEN 'PASS' ELSE 'FAIL' END);
  PERFORM set_config('app.lifecycle_bypass','on',true);
  UPDATE public.agent_settings SET account_activated_at=NULL WHERE user_id=v_pending;
  PERFORM set_config('app.lifecycle_bypass','off',true);

  INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('11_grants',
    concat('anon:', has_function_privilege('anon','public.mark_agent_activated(uuid)','EXECUTE'),
           ' authenticated:', has_function_privilege('authenticated','public.mark_agent_activated(uuid)','EXECUTE'),
           ' service_role:', has_function_privilege('service_role','public.mark_agent_activated(uuid)','EXECUTE'),
           ' public:', has_function_privilege('public','public.mark_agent_activated(uuid)','EXECUTE')));

  INSERT INTO public._tmp_lifecycle_test_results(test,result) VALUES('12_residual_state',
    concat('verified_activated=', (SELECT account_activated_at IS NOT NULL FROM public.agent_settings WHERE user_id=v_verified),
           ' pending_status=', (SELECT agent_status FROM public.agent_settings WHERE user_id=v_pending),
           ' pending_activated=', (SELECT account_activated_at IS NOT NULL FROM public.agent_settings WHERE user_id=v_pending)));

  PERFORM set_config('request.jwt.claims','',true);
  PERFORM set_config('request.method','',true);
END $$;