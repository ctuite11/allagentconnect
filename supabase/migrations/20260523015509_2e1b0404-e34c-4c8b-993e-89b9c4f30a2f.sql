
-- 1. Add column + index
ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS email_enqueued_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_pending_email
  ON public.conversation_messages (created_at)
  WHERE read_at IS NULL AND email_enqueued_at IS NULL;

-- 2. Drop immediate-send trigger (keep function harmless)
DROP TRIGGER IF EXISTS trg_enqueue_message_email ON public.conversation_messages;

-- 3. Deferred processor
CREATE OR REPLACE FUNCTION public.process_pending_message_emails(grace_minutes int DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  recipient_email text;
  sender_name text;
  snippet text;
  processed int := 0;
BEGIN
  FOR r IN
    SELECT id, conversation_id, sender_agent_id, recipient_agent_id, body
    FROM public.conversation_messages
    WHERE read_at IS NULL
      AND email_enqueued_at IS NULL
      AND recipient_agent_id IS NOT NULL
      AND recipient_agent_id <> sender_agent_id
      AND created_at < now() - make_interval(mins => grace_minutes)
    ORDER BY created_at
    LIMIT 500
  LOOP
    SELECT ap.email INTO recipient_email FROM public.agent_profiles ap WHERE ap.id = r.recipient_agent_id;
    IF recipient_email IS NULL THEN
      SELECT p.email INTO recipient_email FROM public.profiles p WHERE p.id = r.recipient_agent_id;
    END IF;

    IF recipient_email IS NULL THEN
      -- Mark as enqueued anyway so we don't keep retrying
      UPDATE public.conversation_messages SET email_enqueued_at = now() WHERE id = r.id;
      CONTINUE;
    END IF;

    SELECT CONCAT_WS(' ', ap.first_name, ap.last_name) INTO sender_name FROM public.agent_profiles ap WHERE ap.id = r.sender_agent_id;
    IF sender_name IS NULL OR sender_name = '' THEN
      SELECT CONCAT_WS(' ', p.first_name, p.last_name) INTO sender_name FROM public.profiles p WHERE p.id = r.sender_agent_id;
    END IF;
    IF sender_name IS NULL OR sender_name = '' THEN
      sender_name := 'Someone';
    END IF;

    snippet := left(coalesce(r.body, ''), 500);

    INSERT INTO public.email_jobs (payload)
    VALUES (jsonb_build_object(
      'provider', 'resend',
      'template', 'new-message-notification',
      'to', recipient_email,
      'subject', 'New message from ' || sender_name,
      'variables', jsonb_build_object(
        'sender_name', sender_name,
        'message_body', snippet,
        'conversation_id', r.conversation_id::text,
        'cta_url', '/messages/' || r.conversation_id::text
      )
    ));

    UPDATE public.conversation_messages SET email_enqueued_at = now() WHERE id = r.id;
    processed := processed + 1;
  END LOOP;

  RETURN processed;
END;
$$;

-- 4. Schedule via pg_cron (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pending-message-emails') THEN
    PERFORM cron.unschedule('process-pending-message-emails');
  END IF;
  PERFORM cron.schedule(
    'process-pending-message-emails',
    '* * * * *',
    $cron$ SELECT public.process_pending_message_emails(10); $cron$
  );
END $$;
