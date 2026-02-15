
-- ============================================================
-- FIX 1: SECURITY DEFINER RPC for agent to view client favorites
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_client_favorites_for_agent(p_client_id uuid)
RETURNS TABLE (
  id uuid,
  listing_id uuid,
  created_at timestamptz,
  address text,
  city text,
  state text,
  zip_code text,
  price numeric,
  bedrooms integer,
  bathrooms numeric,
  square_feet integer,
  property_type text,
  photos jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has an active relationship with this client
  IF NOT EXISTS (
    SELECT 1 FROM public.client_agent_relationships
    WHERE agent_id = auth.uid()
      AND client_id = p_client_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'No active relationship with this client';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.listing_id,
    f.created_at,
    l.address,
    l.city,
    l.state,
    l.zip_code,
    l.price,
    l.bedrooms,
    l.bathrooms,
    l.square_feet,
    l.property_type,
    l.photos
  FROM public.favorites f
  JOIN public.listings l ON l.id = f.listing_id
  WHERE f.user_id = p_client_id
  ORDER BY f.created_at DESC;
END;
$$;

-- ============================================================
-- FIX 2: Agent presence heartbeat + comment notifications
-- ============================================================

-- Add last_seen_at to agent_settings for lightweight presence
ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- In-app notifications table
CREATE TABLE IF NOT EXISTS public.agent_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own notifications"
  ON public.agent_notifications FOR SELECT
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents can update own notifications"
  ON public.agent_notifications FOR UPDATE
  USING (auth.uid() = agent_id);

-- Trigger: on hot_sheet_comments insert, create notification + enqueue email if offline
CREATE OR REPLACE FUNCTION public.on_hot_sheet_comment_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
  v_hot_sheet_name text;
  v_listing_address text;
  v_client_name text;
  v_agent_email text;
  v_agent_first text;
  v_last_seen timestamptz;
  v_recent_email_exists boolean;
BEGIN
  -- Resolve the agent who owns the hot sheet
  SELECT hs.user_id, hs.name INTO v_agent_id, v_hot_sheet_name
  FROM public.hot_sheets hs WHERE hs.id = NEW.hot_sheet_id;

  IF v_agent_id IS NULL THEN RETURN NEW; END IF;

  -- Get listing address
  SELECT l.address INTO v_listing_address
  FROM public.listings l WHERE l.id = NEW.listing_id;

  -- Get commenter name
  SELECT p.first_name || ' ' || p.last_name INTO v_client_name
  FROM public.profiles p WHERE p.id = auth.uid();

  -- Always create in-app notification
  INSERT INTO public.agent_notifications (agent_id, type, title, body, metadata)
  VALUES (
    v_agent_id,
    'hot_sheet_comment',
    'New comment on ' || COALESCE(v_listing_address, 'a listing'),
    COALESCE(v_client_name, 'A client') || ' commented: ' || LEFT(NEW.comment, 120),
    jsonb_build_object(
      'hot_sheet_id', NEW.hot_sheet_id,
      'listing_id', NEW.listing_id,
      'comment_id', NEW.id
    )
  );

  -- Check if agent is offline (last_seen > 5 minutes ago or null)
  SELECT s.last_seen_at INTO v_last_seen
  FROM public.agent_settings s WHERE s.user_id = v_agent_id;

  IF v_last_seen IS NOT NULL AND v_last_seen > now() - interval '5 minutes' THEN
    -- Agent is online, skip email
    RETURN NEW;
  END IF;

  -- Debounce: skip if an email was already enqueued for this hot sheet in last 10 minutes
  SELECT EXISTS (
    SELECT 1 FROM public.email_jobs
    WHERE status IN ('queued', 'processing', 'sent')
      AND created_at > now() - interval '10 minutes'
      AND payload->>'template' = 'hot-sheet-comment'
      AND payload->'variables'->>'hot_sheet_id' = NEW.hot_sheet_id::text
      AND payload->'variables'->>'agent_id' = v_agent_id::text
  ) INTO v_recent_email_exists;

  IF v_recent_email_exists THEN RETURN NEW; END IF;

  -- Get agent email
  SELECT ap.email, ap.first_name INTO v_agent_email, v_agent_first
  FROM public.agent_profiles ap WHERE ap.id = v_agent_id;

  IF v_agent_email IS NULL THEN RETURN NEW; END IF;

  -- Enqueue email notification
  INSERT INTO public.email_jobs (payload)
  VALUES (jsonb_build_object(
    'provider', 'resend',
    'template', 'hot-sheet-comment',
    'to', v_agent_email,
    'subject', 'New comment on your Hot Sheet "' || COALESCE(v_hot_sheet_name, 'Untitled') || '"',
    'variables', jsonb_build_object(
      'agentName', COALESCE(v_agent_first, 'Agent'),
      'clientName', COALESCE(v_client_name, 'Your client'),
      'hotSheetName', COALESCE(v_hot_sheet_name, 'Untitled'),
      'listingAddress', COALESCE(v_listing_address, 'a listing'),
      'commentPreview', LEFT(NEW.comment, 200),
      'hot_sheet_id', NEW.hot_sheet_id::text,
      'agent_id', v_agent_id::text
    )
  ));

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hot_sheet_comment_notify
  AFTER INSERT ON public.hot_sheet_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.on_hot_sheet_comment_inserted();
