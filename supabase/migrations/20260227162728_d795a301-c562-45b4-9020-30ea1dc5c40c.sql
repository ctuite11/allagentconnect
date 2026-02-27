-- Trigger: enqueue email notification when a new message is inserted
CREATE OR REPLACE FUNCTION public.enqueue_message_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recipient_email text;
  sender_name text;
  snippet text;
BEGIN
  -- Do not email self-sent
  IF NEW.recipient_agent_id IS NULL OR NEW.sender_agent_id = NEW.recipient_agent_id THEN
    RETURN NEW;
  END IF;

  -- Resolve recipient email: agent_profiles first, then profiles fallback
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

  -- Resolve sender display name (agent_profiles then profiles)
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

  -- Enqueue email job using payload jsonb column
  INSERT INTO public.email_jobs (payload)
  VALUES (jsonb_build_object(
    'provider', 'resend',
    'template', 'new-message-notification',
    'to', recipient_email,
    'subject', 'New message from ' || sender_name,
    'variables', jsonb_build_object(
      'sender_name', sender_name,
      'message_body', snippet,
      'conversation_id', NEW.conversation_id::text,
      'cta_url', 'https://allagentconnect.lovable.app/messages/' || NEW.conversation_id::text
    )
  ));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_message_email ON public.conversation_messages;

CREATE TRIGGER trg_enqueue_message_email
AFTER INSERT ON public.conversation_messages
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_message_email();