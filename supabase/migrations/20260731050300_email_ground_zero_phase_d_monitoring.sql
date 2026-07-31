-- Ground Zero Phase D: read-only admin safety dashboard RPC.
-- No automatic reopen. Manual staged restart is operational only.

CREATE OR REPLACE FUNCTION public.email_safety_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ctrl public.email_control_state%ROWTYPE;
  v_queued jsonb;
  v_processing integer;
  v_quarantined integer;
  v_sends_5m integer;
  v_sends_today integer;
  v_unique_today integer;
  v_max_recipient_today integer;
  v_max_fanout integer;
  v_suppressions integer;
  v_unknown_attempts integer;
  v_last_provider_call timestamptz;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    -- Allow service_role (auth.uid() null under service role JWT in some paths)
    IF current_setting('role', true) IS DISTINCT FROM 'service_role'
       AND NOT (
         COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
       ) THEN
      RAISE EXCEPTION 'admin only';
    END IF;
  END IF;

  SELECT * INTO v_ctrl FROM public.email_control_state WHERE id = true;

  SELECT COALESCE(jsonb_object_agg(stream, cnt), '{}'::jsonb)
  INTO v_queued
  FROM (
    SELECT COALESCE(stream, 'null') AS stream, COUNT(*)::integer AS cnt
    FROM public.email_jobs
    WHERE status = 'queued'
    GROUP BY stream
  ) q;

  SELECT COUNT(*)::integer INTO v_processing
  FROM public.email_jobs WHERE status = 'processing';

  SELECT COUNT(*)::integer INTO v_quarantined
  FROM public.email_jobs WHERE status = 'quarantined';

  SELECT COUNT(*)::integer INTO v_sends_5m
  FROM public.email_delivery_ledger
  WHERE result = 'sent'
    AND COALESCE(provider_call_at, created_at) >= now() - interval '5 minutes';

  SELECT COUNT(*)::integer INTO v_sends_today
  FROM public.email_delivery_ledger
  WHERE result = 'sent'
    AND COALESCE(provider_call_at, created_at) >= date_trunc('day', now() AT TIME ZONE 'America/New_York')
        AT TIME ZONE 'America/New_York';

  SELECT COUNT(DISTINCT recipient_email)::integer INTO v_unique_today
  FROM public.email_delivery_ledger
  WHERE result = 'sent'
    AND COALESCE(provider_call_at, created_at) >= date_trunc('day', now() AT TIME ZONE 'America/New_York')
        AT TIME ZONE 'America/New_York';

  SELECT COALESCE(MAX(c.cnt), 0) INTO v_max_recipient_today
  FROM (
    SELECT recipient_email, COUNT(*)::integer AS cnt
    FROM public.email_delivery_ledger
    WHERE COALESCE(provider_call_at, created_at) >= date_trunc('day', now() AT TIME ZONE 'America/New_York')
        AT TIME ZONE 'America/New_York'
      AND result = 'sent'
    GROUP BY recipient_email
  ) c;

  SELECT COALESCE(MAX(recipient_count), 0) INTO v_max_fanout
  FROM public.email_source_events
  WHERE created_at >= now() - interval '7 days';

  SELECT COUNT(*)::integer INTO v_suppressions
  FROM public.email_frequency_suppressions
  WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/New_York')
      AT TIME ZONE 'America/New_York';

  SELECT COUNT(*)::integer INTO v_unknown_attempts
  FROM public.email_jobs
  WHERE status = 'quarantined'
    AND (
      last_error ILIKE '%unknown%template%'
      OR last_error ILIKE '%retired%'
      OR last_error ILIKE '%mismatch%'
    );

  SELECT MAX(provider_call_at) INTO v_last_provider_call
  FROM public.email_delivery_ledger
  WHERE provider_call_at IS NOT NULL;

  RETURN jsonb_build_object(
    'ground_zero_at', v_ctrl.ground_zero_at,
    'pauses', jsonb_build_object(
      'global', v_ctrl.global_paused,
      'hot_sheet', v_ctrl.hot_sheet_paused,
      'communications', v_ctrl.communications_paused,
      'transactional', v_ctrl.transactional_paused,
      'system', v_ctrl.system_paused
    ),
    'change', jsonb_build_object(
      'changed_by', v_ctrl.changed_by,
      'changed_at', v_ctrl.changed_at,
      'change_reason', v_ctrl.change_reason
    ),
    'queued_by_stream', v_queued,
    'processing', v_processing,
    'quarantined', v_quarantined,
    'sends_last_5_minutes', v_sends_5m,
    'sends_today', v_sends_today,
    'unique_recipients_today', v_unique_today,
    'highest_per_recipient_today', v_max_recipient_today,
    'largest_source_event_fanout', v_max_fanout,
    'frequency_suppressions_today', v_suppressions,
    'unknown_or_retired_template_attempts', v_unknown_attempts,
    'last_provider_call_at', v_last_provider_call,
    'last_automatic_shutdown', jsonb_build_object(
      'reason', v_ctrl.last_auto_shutdown_reason,
      'at', v_ctrl.last_auto_shutdown_at,
      'source_event_id', v_ctrl.last_auto_shutdown_source_event
    ),
    'restart_sequence', jsonb_build_array(
      'internal_canary',
      'transactional',
      'hot_sheet',
      'communications'
    ),
    'automatic_reopen', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.email_safety_dashboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.email_safety_dashboard() FROM anon;
GRANT EXECUTE ON FUNCTION public.email_safety_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.email_safety_dashboard() TO service_role;
