-- ============================================
-- AGENT CHAT: Unread badge + per-user read cursor
-- ============================================

-- 1) Add last_message_at to conversations for sorting + fast unread checks
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS last_message_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
ON public.conversations (last_message_at DESC);

-- 2) Create conversation_participants for per-user read cursor
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user
ON public.conversation_participants (user_id, conversation_id);

-- 3) RLS for conversation_participants
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cp_select_own" ON public.conversation_participants;
CREATE POLICY "cp_select_own"
ON public.conversation_participants FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "cp_update_own" ON public.conversation_participants;
CREATE POLICY "cp_update_own"
ON public.conversation_participants FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cp_insert_auth" ON public.conversation_participants;
CREATE POLICY "cp_insert_auth"
ON public.conversation_participants FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- 4) Trigger: bump conversations.last_message_at when a message is inserted
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
RETURNS trigger AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_conversation_message_insert ON public.conversation_messages;

CREATE TRIGGER trg_conversation_message_insert
AFTER INSERT ON public.conversation_messages
FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message_at();

-- 5) RLS for conversations (ensure participant-based access)
DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
ON public.conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
  )
  OR agent_a_id = auth.uid()
  OR agent_b_id = auth.uid()
);

DROP POLICY IF EXISTS "conversations_insert_auth" ON public.conversations;
CREATE POLICY "conversations_insert_auth"
ON public.conversations FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- 6) RLS for conversation_messages
DROP POLICY IF EXISTS "messages_select_participant" ON public.conversation_messages;
CREATE POLICY "messages_select_participant"
ON public.conversation_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_messages.conversation_id
      AND cp.user_id = auth.uid()
  )
  OR sender_agent_id = auth.uid()
  OR recipient_agent_id = auth.uid()
);

DROP POLICY IF EXISTS "messages_insert_participant" ON public.conversation_messages;
CREATE POLICY "messages_insert_participant"
ON public.conversation_messages FOR INSERT
WITH CHECK (
  sender_agent_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_messages.conversation_id
        AND cp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_messages.conversation_id
        AND (c.agent_a_id = auth.uid() OR c.agent_b_id = auth.uid())
    )
  )
);

-- 7) Enable Realtime for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;