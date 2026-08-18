
ALTER TABLE public.comms_broadcasts
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by uuid,
  ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.comms_broadcast_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.comms_broadcasts(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, revision_number)
);

GRANT SELECT ON public.comms_broadcast_revisions TO authenticated;
GRANT ALL ON public.comms_broadcast_revisions TO service_role;
GRANT UPDATE (subject, message, edited_at, edited_by, edit_count) ON public.comms_broadcasts TO authenticated;
GRANT UPDATE ON public.comms_broadcast_attachments TO authenticated;

ALTER TABLE public.comms_broadcast_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Eligible agents can read broadcast revisions" ON public.comms_broadcast_revisions;
CREATE POLICY "Eligible agents can read broadcast revisions"
  ON public.comms_broadcast_revisions FOR SELECT TO authenticated
  USING (
    edited_by = auth.uid()
    OR public.current_is_eligible_agent()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Owner (or admin) may edit their own sent broadcast.
DROP POLICY IF EXISTS "Senders can update their own broadcasts" ON public.comms_broadcasts;
CREATE POLICY "Senders can update their own broadcasts"
  ON public.comms_broadcasts FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Attachment writes must target a broadcast the caller owns.
DROP POLICY IF EXISTS "Senders can add their own broadcast attachments" ON public.comms_broadcast_attachments;
CREATE POLICY "Senders can add their own broadcast attachments"
  ON public.comms_broadcast_attachments FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.comms_broadcasts b
      WHERE b.id = broadcast_id AND b.sender_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Senders can delete their own broadcast attachments" ON public.comms_broadcast_attachments;
CREATE POLICY "Senders can delete their own broadcast attachments"
  ON public.comms_broadcast_attachments FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Immutability guard: sender_id / category / created_at can never change on edit.
CREATE OR REPLACE FUNCTION public.comms_broadcast_edit_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.recipient_count IS DISTINCT FROM OLD.recipient_count
     OR NEW.criteria IS DISTINCT FROM OLD.criteria THEN
    RAISE EXCEPTION 'Only subject, message and edit metadata may be updated on a sent broadcast';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comms_broadcast_edit_guard ON public.comms_broadcasts;
CREATE TRIGGER trg_comms_broadcast_edit_guard
  BEFORE UPDATE ON public.comms_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.comms_broadcast_edit_guard();

-- Single entry point for an edit: snapshots the previous version, applies new
-- content, and reconciles attachments. Sends nothing.
CREATE OR REPLACE FUNCTION public.update_comms_broadcast(
  _broadcast_id uuid,
  _subject text,
  _message text,
  _attachments jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.comms_broadcasts%ROWTYPE;
  caller uuid := auth.uid();
  is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  prev jsonb;
  next_rev integer;
  keep_paths text[];
  item jsonb;
  idx integer := 0;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO b FROM public.comms_broadcasts WHERE id = _broadcast_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Communication not found';
  END IF;
  IF b.sender_id <> caller AND NOT is_admin THEN
    RAISE EXCEPTION 'You can only edit Communications you sent';
  END IF;

  IF _subject IS NULL OR btrim(_subject) = '' THEN
    RAISE EXCEPTION 'Subject is required';
  END IF;
  IF _message IS NULL OR btrim(_message) = '' THEN
    RAISE EXCEPTION 'Message is required';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'path', a.path, 'kind', a.kind, 'mimeType', a.mime_type,
           'name', a.file_name, 'size', a.size_bytes
         ) ORDER BY a.sort_order), '[]'::jsonb)
    INTO prev
    FROM public.comms_broadcast_attachments a
   WHERE a.broadcast_id = _broadcast_id;

  SELECT COALESCE(MAX(revision_number), 0) + 1 INTO next_rev
    FROM public.comms_broadcast_revisions WHERE broadcast_id = _broadcast_id;

  INSERT INTO public.comms_broadcast_revisions
    (broadcast_id, revision_number, subject, message, attachments, edited_by)
  VALUES (_broadcast_id, next_rev, b.subject, b.message, prev, caller);

  UPDATE public.comms_broadcasts
     SET subject = _subject,
         message = _message,
         edited_at = now(),
         edited_by = caller,
         edit_count = edit_count + 1
   WHERE id = _broadcast_id;

  IF _attachments IS NOT NULL THEN
    IF jsonb_typeof(_attachments) <> 'array' THEN
      RAISE EXCEPTION 'attachments must be an array';
    END IF;
    IF jsonb_array_length(_attachments) > 10 THEN
      RAISE EXCEPTION 'at most 10 attachments are allowed';
    END IF;

    SELECT COALESCE(array_agg(x->>'path'), ARRAY[]::text[]) INTO keep_paths
      FROM jsonb_array_elements(_attachments) x;

    DELETE FROM public.comms_broadcast_attachments
     WHERE broadcast_id = _broadcast_id
       AND NOT (path = ANY (keep_paths));

    FOR item IN SELECT * FROM jsonb_array_elements(_attachments)
    LOOP
      IF (item->>'path') IS NULL OR position((b.sender_id::text || '/') in (item->>'path')) <> 1 THEN
        RAISE EXCEPTION 'attachment path does not belong to the sender';
      END IF;
      IF (item->>'kind') NOT IN ('image','video') THEN
        RAISE EXCEPTION 'attachment kind must be image or video';
      END IF;

      INSERT INTO public.comms_broadcast_attachments
        (broadcast_id, sender_id, path, kind, mime_type, file_name, size_bytes, sort_order)
      VALUES (
        _broadcast_id, b.sender_id, item->>'path', item->>'kind',
        COALESCE(item->>'mimeType',''), COALESCE(item->>'name','attachment'),
        COALESCE((item->>'size')::bigint, 0), idx
      )
      ON CONFLICT (broadcast_id, path) DO UPDATE
        SET sort_order = EXCLUDED.sort_order,
            kind = EXCLUDED.kind,
            mime_type = EXCLUDED.mime_type,
            file_name = EXCLUDED.file_name,
            size_bytes = EXCLUDED.size_bytes;
      idx := idx + 1;
    END LOOP;
  END IF;

  RETURN _broadcast_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_comms_broadcast(uuid, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.update_comms_broadcast(uuid, text, text, jsonb) TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_comms_attachment_broadcast_path
  ON public.comms_broadcast_attachments (broadcast_id, path);
CREATE INDEX IF NOT EXISTS idx_comms_broadcasts_sender_created
  ON public.comms_broadcasts (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_broadcast_revisions_broadcast
  ON public.comms_broadcast_revisions (broadcast_id, revision_number DESC);
