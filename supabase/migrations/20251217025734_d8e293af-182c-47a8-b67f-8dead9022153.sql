-- 1) Replace the UPDATE policy with a tight one
DROP POLICY IF EXISTS "Recipients can mark messages as read"
ON public.conversation_messages;

CREATE POLICY "Recipients can mark messages as read"
ON public.conversation_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_agent_id)
WITH CHECK (auth.uid() = recipient_agent_id);

-- 2) Column-level privilege: authenticated can ONLY update read_at
REVOKE UPDATE ON public.conversation_messages FROM authenticated;
GRANT UPDATE (read_at) ON public.conversation_messages TO authenticated;