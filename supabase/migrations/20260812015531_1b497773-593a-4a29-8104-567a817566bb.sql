ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.conversation_messages
  ADD CONSTRAINT conversation_messages_attachments_is_array
  CHECK (jsonb_typeof(attachments) = 'array');

CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND (c.agent_a_id = auth.uid() OR c.agent_b_id = auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_conversation_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO service_role;

DROP POLICY IF EXISTS "message attachments select for conversation members" ON storage.objects;
CREATE POLICY "message attachments select for conversation members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "message attachments insert by conversation members" ON storage.objects;
CREATE POLICY "message attachments insert by conversation members"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "message attachments delete by uploader" ON storage.objects;
CREATE POLICY "message attachments delete by uploader"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);