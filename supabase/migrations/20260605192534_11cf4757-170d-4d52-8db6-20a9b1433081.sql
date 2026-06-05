
-- 1. Shared payload builder
CREATE OR REPLACE FUNCTION public.build_message_email_payload(p_message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  recipient_email text;
  sender_name text;
  snippet text;
  v_listing jsonb;
  v_listing_url text;
  v_is_agent_recipient boolean;
  v_variables jsonb;
BEGIN
  SELECT cm.id, cm.conversation_id, cm.sender_agent_id, cm.recipient_agent_id,
         cm.body, c.listing_id
    INTO r
  FROM public.conversation_messages cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  WHERE cm.id = p_message_id;

  IF NOT FOUND OR r.recipient_agent_id IS NULL OR r.recipient_agent_id = r.sender_agent_id THEN
    RETURN NULL;
  END IF;

  SELECT ap.email INTO recipient_email FROM public.agent_profiles ap WHERE ap.id = r.recipient_agent_id;
  IF recipient_email IS NULL THEN
    SELECT p.email INTO recipient_email FROM public.profiles p WHERE p.id = r.recipient_agent_id;
  END IF;
  IF recipient_email IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT CONCAT_WS(' ', ap.first_name, ap.last_name) INTO sender_name
    FROM public.agent_profiles ap WHERE ap.id = r.sender_agent_id;
  IF sender_name IS NULL OR sender_name = '' THEN
    SELECT CONCAT_WS(' ', p.first_name, p.last_name) INTO sender_name
      FROM public.profiles p WHERE p.id = r.sender_agent_id;
  END IF;
  IF sender_name IS NULL OR sender_name = '' THEN
    sender_name := 'Someone';
  END IF;

  snippet := left(coalesce(r.body, ''), 500);

  SELECT EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE ap.id = r.recipient_agent_id)
    INTO v_is_agent_recipient;

  v_listing := NULL;
  v_listing_url := NULL;

  IF r.listing_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', l.id, 'address', l.address, 'unit_number', l.unit_number,
      'city', l.city, 'state', l.state, 'zip_code', l.zip_code, 'price', l.price,
      'bedrooms', l.bedrooms, 'bathrooms', l.bathrooms, 'square_feet', l.square_feet,
      'status', l.status, 'property_type', l.property_type,
      'neighborhood', coalesce(l.neighborhood, l.attom_data->>'neighborhood'),
      'listing_number', l.listing_number, 'photos', l.photos,
      'condo_details', l.condo_details, 'attom_data', l.attom_data,
      'brokerage_name', coalesce(ap.company, ap.office_name),
      'list_office', ap.office_name
    )
    INTO v_listing
    FROM public.listings l
    LEFT JOIN public.agent_profiles ap ON ap.id = l.agent_id
    WHERE l.id = r.listing_id;

    IF v_listing IS NOT NULL THEN
      v_listing_url := CASE
        WHEN v_is_agent_recipient THEN '/property/' || r.listing_id::text
        ELSE '/consumer-property/' || r.listing_id::text
      END;
    END IF;
  END IF;

  v_variables := jsonb_build_object(
    'sender_name', sender_name,
    'message_body', snippet,
    'conversation_id', r.conversation_id::text,
    'message_id', r.id::text,
    'cta_url', '/messages/' || r.conversation_id::text
  );

  IF v_listing IS NOT NULL THEN
    v_variables := v_variables || jsonb_build_object(
      'listing', v_listing,
      'listing_id', r.listing_id::text,
      'listing_url', v_listing_url,
      'listing_address', coalesce(v_listing->>'address', ''),
      'recipient_role', CASE WHEN v_is_agent_recipient THEN 'agent' ELSE 'buyer' END
    );
  END IF;

  RETURN jsonb_build_object(
    'provider', 'resend',
    'template', 'new-message-notification',
    'to', recipient_email,
    'subject', 'New message from ' || sender_name,
    'variables', v_variables
  );
END;
$$;

-- 2. Trigger: immediate enqueue with 60s delay
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

  INSERT INTO public.email_jobs (payload, run_after)
  VALUES (v_payload, now() + interval '60 seconds');

  UPDATE public.conversation_messages SET email_enqueued_at = now() WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_message_email ON public.conversation_messages;
CREATE TRIGGER trg_enqueue_message_email
AFTER INSERT ON public.conversation_messages
FOR EACH ROW EXECUTE FUNCTION public.enqueue_message_email_trigger();

-- 3. Backstop cron function: tightened grace, shared payload
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
    INSERT INTO public.email_jobs (payload) VALUES (v_payload);
    UPDATE public.conversation_messages SET email_enqueued_at = now() WHERE id = r.id;
    processed := processed + 1;
  END LOOP;
  RETURN processed;
END;
$$;
