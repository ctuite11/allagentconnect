-- Explicit "Send Again" support for an already-sent Communications broadcast.
-- No new comms_broadcasts row is ever created by a resend.

CREATE TABLE public.comms_broadcast_resends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.comms_broadcasts(id) ON DELETE CASCADE,
  resend_number integer NOT NULL,
  resend_token text NOT NULL,
  sent_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comms_broadcast_resends_status_chk
    CHECK (status IN ('started', 'completed', 'skipped_paused', 'failed'))
);

CREATE UNIQUE INDEX comms_broadcast_resends_number_uniq
  ON public.comms_broadcast_resends (broadcast_id, resend_number);
CREATE UNIQUE INDEX comms_broadcast_resends_token_uniq
  ON public.comms_broadcast_resends (broadcast_id, resend_token);
CREATE INDEX comms_broadcast_resends_broadcast_idx
  ON public.comms_broadcast_resends (broadcast_id, created_at DESC);

GRANT SELECT ON public.comms_broadcast_resends TO authenticated;
GRANT ALL ON public.comms_broadcast_resends TO service_role;

ALTER TABLE public.comms_broadcast_resends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Senders can view their own broadcast resends"
  ON public.comms_broadcast_resends
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.comms_broadcasts b
      WHERE b.id = comms_broadcast_resends.broadcast_id
        AND b.sender_id = auth.uid()
    )
  );

CREATE TRIGGER update_comms_broadcast_resends_updated_at
  BEFORE UPDATE ON public.comms_broadcast_resends
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Idempotent resend reservation. Called with the caller's JWT: only the
-- original sender may start a resend. Re-calling with the same token returns
-- the existing reservation instead of creating a second one.
CREATE OR REPLACE FUNCTION public.begin_comms_broadcast_resend(
  _broadcast_id uuid,
  _resend_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender uuid;
  _existing public.comms_broadcast_resends%ROWTYPE;
  _next integer;
  _row public.comms_broadcast_resends%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF _resend_token IS NULL OR btrim(_resend_token) = '' THEN
    RAISE EXCEPTION 'A resend token is required';
  END IF;

  SELECT sender_id INTO _sender
  FROM public.comms_broadcasts
  WHERE id = _broadcast_id;

  IF _sender IS NULL THEN
    RAISE EXCEPTION 'Communication not found';
  END IF;
  IF _sender <> auth.uid() THEN
    RAISE EXCEPTION 'You can only resend Communications you sent';
  END IF;

  SELECT * INTO _existing
  FROM public.comms_broadcast_resends
  WHERE broadcast_id = _broadcast_id
    AND resend_token = btrim(_resend_token);

  IF FOUND THEN
    RETURN jsonb_build_object(
      'resend_id', _existing.id,
      'resend_number', _existing.resend_number,
      'already_started', true,
      'status', _existing.status,
      'recipient_count', _existing.recipient_count
    );
  END IF;

  -- Serialize concurrent resends of the same broadcast.
  PERFORM pg_advisory_xact_lock(hashtextextended(_broadcast_id::text, 0));

  SELECT COALESCE(MAX(resend_number), 0) + 1 INTO _next
  FROM public.comms_broadcast_resends
  WHERE broadcast_id = _broadcast_id;

  INSERT INTO public.comms_broadcast_resends
    (broadcast_id, resend_number, resend_token, sent_by)
  VALUES (_broadcast_id, _next, btrim(_resend_token), auth.uid())
  RETURNING * INTO _row;

  RETURN jsonb_build_object(
    'resend_id', _row.id,
    'resend_number', _row.resend_number,
    'already_started', false,
    'status', _row.status,
    'recipient_count', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_comms_broadcast_resend(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_comms_broadcast_resend(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_comms_broadcast_resend(uuid, text) TO service_role;