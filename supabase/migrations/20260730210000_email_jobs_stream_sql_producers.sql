-- Ensure all SQL producers set email_jobs.stream explicitly.
-- Companion to 20260730200000_email_stream_channel_claim.sql.

-- 1) Hot Sheet comment / agent-reply emails
CREATE OR REPLACE FUNCTION public.on_hot_sheet_comment_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent_id uuid;
  v_hot_sheet_name text;
  v_listing_address text;

  v_client_name text;
  v_agent_email text;
  v_agent_first text;
  v_last_seen timestamptz;
  v_recent_email_exists boolean;

  r_client record;
  v_replying_agent_first text;
  v_recent_client_email_exists boolean;
  v_unified_message_exists boolean;
BEGIN
  IF COALESCE(NEW.suppress_email_notification, false) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_messages cm
    INNER JOIN public.conversations c ON c.id = cm.conversation_id
    WHERE c.listing_id = NEW.listing_id
      AND cm.body = NEW.comment
      AND cm.created_at >= NEW.created_at - interval '10 minutes'
      AND cm.created_at <= NEW.created_at + interval '1 minute'
  )
  INTO v_unified_message_exists;

  IF v_unified_message_exists THEN
    RETURN NEW;
  END IF;

  SELECT hs.user_id, hs.name
    INTO v_agent_id, v_hot_sheet_name
  FROM public.hot_sheets hs
  WHERE hs.id = NEW.hot_sheet_id;

  IF v_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT l.address
    INTO v_listing_address
  FROM public.listings l
  WHERE l.id = NEW.listing_id;

  v_listing_address := coalesce(nullif(v_listing_address, ''), 'a listing');

  IF NEW.sender_role = 'client' THEN
    SELECT nullif(trim(p.first_name || ' ' || p.last_name), '')
      INTO v_client_name
    FROM public.profiles p
    WHERE p.id = NEW.sender_id;

    v_client_name := coalesce(v_client_name, 'A client');

    INSERT INTO public.agent_notifications (agent_id, type, title, body, metadata)
    VALUES (
      v_agent_id,
      'hot_sheet_comment',
      'New comment on ' || v_listing_address,
      v_client_name || ' commented: ' || left(coalesce(NEW.comment, ''), 120),
      jsonb_build_object(
        'hot_sheet_id', NEW.hot_sheet_id,
        'listing_id', NEW.listing_id,
        'comment_id', NEW.id
      )
    );

    SELECT s.last_seen_at
      INTO v_last_seen
    FROM public.agent_settings s
    WHERE s.user_id = v_agent_id;

    IF v_last_seen IS NOT NULL AND v_last_seen > now() - interval '5 minutes' THEN
      RETURN NEW;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.email_jobs
      WHERE status IN ('queued', 'processing', 'sent')
        AND created_at > now() - interval '10 minutes'
        AND payload->>'template' = 'hot-sheet-comment'
        AND payload->'variables'->>'hot_sheet_id' = NEW.hot_sheet_id::text
        AND payload->'variables'->>'agent_id' = v_agent_id::text
    )
    INTO v_recent_email_exists;

    IF v_recent_email_exists THEN
      RETURN NEW;
    END IF;

    SELECT ap.email, ap.first_name
      INTO v_agent_email, v_agent_first
    FROM public.agent_profiles ap
    WHERE ap.id = v_agent_id;

    IF v_agent_email IS NULL OR v_agent_email = '' THEN
      RETURN NEW;
    END IF;

    v_agent_first := coalesce(nullif(v_agent_first, ''), 'Agent');

    INSERT INTO public.email_jobs (stream, payload, idempotency_key)
    VALUES (
      'hot_sheet',
      jsonb_build_object(
        'provider', 'resend',
        'template', 'hot-sheet-comment',
        'to', v_agent_email,
        'subject',
          'New comment on your Hot Sheet "' || coalesce(nullif(v_hot_sheet_name, ''), 'Untitled') || '"',
        'category', 'hot_sheet_alerts',
        'variables', jsonb_build_object(
          'agentName', v_agent_first,
          'clientName', v_client_name,
          'hotSheetName', coalesce(nullif(v_hot_sheet_name, ''), 'Untitled'),
          'listingAddress', v_listing_address,
          'commentPreview', left(coalesce(NEW.comment, ''), 200),
          'hot_sheet_id', NEW.hot_sheet_id::text,
          'agent_id', v_agent_id::text
        )
      ),
      'hot_sheet_comment:' || NEW.id::text
    );

    RETURN NEW;
  END IF;

  IF NEW.sender_role = 'agent' THEN
    SELECT ap.first_name
      INTO v_replying_agent_first
    FROM public.agent_profiles ap
    WHERE ap.id = NEW.sender_id;

    v_replying_agent_first := coalesce(nullif(v_replying_agent_first, ''), 'Your agent');

    FOR r_client IN
      SELECT
        c.id AS client_id,
        c.email AS client_email,
        c.first_name AS client_first_name
      FROM public.hot_sheet_clients hsc
      JOIN public.clients c ON c.id = hsc.client_id
      WHERE hsc.hot_sheet_id = NEW.hot_sheet_id
        AND c.email IS NOT NULL
        AND c.email <> ''
    LOOP
      SELECT EXISTS (
        SELECT 1
        FROM public.email_jobs
        WHERE status IN ('queued', 'processing', 'sent')
          AND created_at > now() - interval '10 minutes'
          AND payload->>'template' = 'hot-sheet-agent-reply'
          AND payload->'variables'->>'hot_sheet_id' = NEW.hot_sheet_id::text
          AND payload->'variables'->>'client_id' = r_client.client_id::text
          AND payload->'variables'->>'listing_id' = NEW.listing_id::text
      )
      INTO v_recent_client_email_exists;

      IF v_recent_client_email_exists THEN
        CONTINUE;
      END IF;

      INSERT INTO public.email_jobs (stream, payload, idempotency_key)
      VALUES (
        'hot_sheet',
        jsonb_build_object(
          'provider', 'resend',
          'template', 'hot-sheet-agent-reply',
          'to', r_client.client_email,
          'subject',
            v_replying_agent_first || ' posted an update in "' || coalesce(nullif(v_hot_sheet_name, ''), 'Untitled') || '"',
          'category', 'hot_sheet_alerts',
          'variables', jsonb_build_object(
            'clientName', coalesce(nullif(r_client.client_first_name, ''), 'there'),
            'agentName', v_replying_agent_first,
            'hotSheetName', coalesce(nullif(v_hot_sheet_name, ''), 'Untitled'),
            'listingAddress', v_listing_address,
            'commentPreview', left(coalesce(NEW.comment, ''), 200),
            'hot_sheet_id', NEW.hot_sheet_id::text,
            'client_id', r_client.client_id::text,
            'agent_id', NEW.sender_id::text,
            'listing_id', NEW.listing_id::text,
            'comment_id', NEW.id::text
          )
        ),
        'hot_sheet_agent_reply:' || NEW.id::text || ':' || r_client.client_id::text
      );
    END LOOP;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Message notification enqueue (transactional)
CREATE OR REPLACE FUNCTION public.enqueue_message_email_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  IF NEW.recipient_agent_id IS NULL OR NEW.recipient_agent_id = NEW.sender_agent_id THEN
    RETURN NEW;
  END IF;

  v_payload := public.build_message_email_payload(NEW.id);
  IF v_payload IS NULL THEN
    UPDATE public.conversation_messages SET email_enqueued_at = now() WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.email_jobs (stream, payload, run_after)
  VALUES ('transactional', v_payload, now() + interval '60 seconds');

  UPDATE public.conversation_messages SET email_enqueued_at = now() WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_pending_message_emails(grace_minutes integer DEFAULT 2)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_payload jsonb;
  processed int := 0;
BEGIN
  FOR r IN
    SELECT cm.id
    FROM public.conversation_messages cm
    WHERE cm.read_at IS NULL
      AND cm.email_enqueued_at IS NULL
      AND cm.recipient_agent_id IS NOT NULL
      AND cm.recipient_agent_id <> cm.sender_agent_id
      AND cm.created_at < now() - make_interval(mins => grace_minutes)
    ORDER BY cm.created_at
    LIMIT 500
  LOOP
    v_payload := public.build_message_email_payload(r.id);
    IF v_payload IS NULL THEN
      UPDATE public.conversation_messages SET email_enqueued_at = now() WHERE id = r.id;
      CONTINUE;
    END IF;
    INSERT INTO public.email_jobs (stream, payload) VALUES ('transactional', v_payload);
    UPDATE public.conversation_messages SET email_enqueued_at = now() WHERE id = r.id;
    processed := processed + 1;
  END LOOP;
  RETURN processed;
END;
$$;

-- 3) Missing-opportunity reminder enqueue (transactional)
CREATE OR REPLACE FUNCTION public.reserve_and_enqueue_missing_opportunity_reminder(
  _agent_id uuid,
  _event_type text,
  _event_id uuid,
  _email text,
  _email_job jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reserved integer := 0;
  _recent_exists boolean := false;
  _idempotency_key text;
  _payload jsonb;
  _stream text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_missing_opportunity_reminders
    WHERE agent_id = _agent_id
      AND sent_at > now() - interval '30 days'
  ) INTO _recent_exists;

  IF _recent_exists THEN
    RETURN jsonb_build_object(
      'reserved', false,
      'queued', false,
      'reason', 'cadence_30d'
    );
  END IF;

  INSERT INTO public.agent_missing_opportunity_reminders
    (agent_id, event_type, event_id, email)
  VALUES (_agent_id, _event_type, _event_id, _email)
  ON CONFLICT (agent_id, event_type, event_id) DO NOTHING;

  GET DIAGNOSTICS _reserved = ROW_COUNT;

  IF _reserved = 0 THEN
    RETURN jsonb_build_object(
      'reserved', false,
      'queued', false,
      'reason', 'duplicate_event'
    );
  END IF;

  _idempotency_key := _email_job->>'idempotency_key';
  _payload := _email_job->'payload';
  _stream := COALESCE(NULLIF(_email_job->>'stream', ''), 'transactional');

  INSERT INTO public.email_jobs (stream, idempotency_key, payload)
  VALUES (_stream, _idempotency_key, _payload);

  RETURN jsonb_build_object('reserved', true, 'queued', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_and_enqueue_missing_opportunity_reminder(uuid, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_and_enqueue_missing_opportunity_reminder(uuid, text, uuid, text, jsonb) TO service_role;
