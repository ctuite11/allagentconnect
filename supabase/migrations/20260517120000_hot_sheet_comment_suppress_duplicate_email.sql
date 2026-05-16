-- Listing threads: conversation_messages owns notifications; hot_sheet_comments may mirror for preview only.
ALTER TABLE public.hot_sheet_comments
ADD COLUMN IF NOT EXISTS suppress_email_notification boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.hot_sheet_comments.suppress_email_notification IS
  'When true, skip hot-sheet comment email/in-app notify (unified conversation_messages already notified).';

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
  -- Preview/backfill row mirrored from conversation_messages — no second alert.
  IF COALESCE(NEW.suppress_email_notification, false) THEN
    RETURN NEW;
  END IF;

  -- Legacy path: skip hot-sheet email if the same text already exists on the listing conversation thread.
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

    INSERT INTO public.email_jobs (payload, idempotency_key)
    VALUES (
      jsonb_build_object(
        'provider', 'resend',
        'template', 'hot-sheet-comment',
        'to', v_agent_email,
        'subject',
          'New comment on your Hot Sheet "' || coalesce(nullif(v_hot_sheet_name, ''), 'Untitled') || '"',
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

      INSERT INTO public.email_jobs (payload, idempotency_key)
      VALUES (
        jsonb_build_object(
          'provider', 'resend',
          'template', 'hot-sheet-agent-reply',
          'to', r_client.client_email,
          'subject',
            v_replying_agent_first || ' posted an update in "' || coalesce(nullif(v_hot_sheet_name, ''), 'Untitled') || '"',
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

CREATE OR REPLACE FUNCTION public.enqueue_message_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipient_email text;
  sender_name text;
  snippet text;
BEGIN
  IF NEW.recipient_agent_id IS NULL OR NEW.sender_agent_id = NEW.recipient_agent_id THEN
    RETURN NEW;
  END IF;

  SELECT ap.email INTO recipient_email
  FROM public.agent_profiles ap
  WHERE ap.id = NEW.recipient_agent_id;

  IF recipient_email IS NULL THEN
    SELECT p.email INTO recipient_email
    FROM public.profiles p
    WHERE p.id = NEW.recipient_agent_id;
  END IF;

  IF recipient_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT CONCAT_WS(' ', ap.first_name, ap.last_name) INTO sender_name
  FROM public.agent_profiles ap
  WHERE ap.id = NEW.sender_agent_id;

  IF sender_name IS NULL OR sender_name = '' THEN
    SELECT CONCAT_WS(' ', p.first_name, p.last_name) INTO sender_name
    FROM public.profiles p
    WHERE p.id = NEW.sender_agent_id;
  END IF;

  IF sender_name IS NULL OR sender_name = '' THEN
    sender_name := 'Someone';
  END IF;

  snippet := left(coalesce(NEW.body, ''), 500);

  INSERT INTO public.email_jobs (payload, idempotency_key)
  VALUES (
    jsonb_build_object(
      'provider', 'resend',
      'template', 'new-message-notification',
      'to', recipient_email,
      'subject', 'New message from ' || sender_name,
      'variables', jsonb_build_object(
        'sender_name', sender_name,
        'message_body', snippet,
        'conversation_id', NEW.conversation_id::text,
        'cta_url', '/messages/' || NEW.conversation_id::text
      )
    ),
    'conversation_message:' || NEW.id::text
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$function$;
