-- Fix RLS: Allow authenticated users to insert participant rows for BOTH users during thread creation
-- This is needed because when creating a conversation, we need to add both participants
DROP POLICY IF EXISTS "cp_insert_self" ON public.conversation_participants;
CREATE POLICY "cp_insert_conversation_creator"
ON public.conversation_participants FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND (
    -- User can insert for themselves
    user_id = auth.uid()
    -- OR user is creating a new conversation (is agent_a or agent_b)
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.agent_a_id = auth.uid() OR c.agent_b_id = auth.uid())
    )
  )
);