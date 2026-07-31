CREATE TABLE IF NOT EXISTS public._tmp_lifecycle_test_results(id serial primary key, test text, result text);
TRUNCATE public._tmp_lifecycle_test_results;

DO $$
DECLARE
  v_pending uuid := '92854aef-1d99-4650-8714-47629c5ab0b9';
  v_prev text; r timestamptz;
BEGIN
  SELECT agent_status::text INTO v_prev FROM public.agent_settings WHERE user_id=v_pending;
  PERFORM set_config('app.lifecycle_bypass','on',true);
  UPDATE public.agent_settings SET agent_status='invited'::agent_status WHERE user_id=v_pending;
  PERFORM set_config('app.lifecycle_bypass','off',true);

  PERFORM set_config('request.method','POST',true);
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',v_pending)::text, true);
  r := public.mark_agent_activated(v_pending);
  INSERT INTO public._tmp_lifecycle_test_results(test,result)
  VALUES('invited_agent_setup_flow', CASE WHEN r IS NOT NULL THEN 'PASS' ELSE 'FAIL' END);

  PERFORM set_config('app.lifecycle_bypass','on',true);
  UPDATE public.agent_settings
     SET agent_status=v_prev::agent_status, verified_at=NULL, account_activated_at=NULL
   WHERE user_id=v_pending;
  PERFORM set_config('app.lifecycle_bypass','off',true);
  PERFORM set_config('request.jwt.claims','',true);
  PERFORM set_config('request.method','',true);

  INSERT INTO public._tmp_lifecycle_test_results(test,result)
  VALUES('restored_state', concat((SELECT agent_status::text FROM public.agent_settings WHERE user_id=v_pending),
    ' activated=', (SELECT account_activated_at IS NOT NULL FROM public.agent_settings WHERE user_id=v_pending)));
END $$;