-- Create conversations table for agent-to-agent messaging
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_a_id UUID NOT NULL,
  agent_b_id UUID NOT NULL,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  buyer_need_id UUID REFERENCES public.client_needs(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_conversation UNIQUE (agent_a_id, agent_b_id, listing_id, buyer_need_id)
);

-- Create conversation_messages table
CREATE TABLE public.conversation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_agent_id UUID NOT NULL,
  recipient_agent_id UUID NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_conversations_agent_a ON public.conversations(agent_a_id);
CREATE INDEX idx_conversations_agent_b ON public.conversations(agent_b_id);
CREATE INDEX idx_conversations_updated_at ON public.conversations(updated_at DESC);
CREATE INDEX idx_conversation_messages_conversation ON public.conversation_messages(conversation_id);
CREATE INDEX idx_conversation_messages_recipient_read ON public.conversation_messages(recipient_agent_id, read_at);

-- Enable RLS on conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations
CREATE POLICY "Agents can view their conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = agent_a_id OR auth.uid() = agent_b_id);

CREATE POLICY "Agents can create conversations they participate in"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = agent_a_id OR auth.uid() = agent_b_id);

CREATE POLICY "Agents can update their conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = agent_a_id OR auth.uid() = agent_b_id);

-- Enable RLS on conversation_messages
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversation_messages
CREATE POLICY "Agents can view messages in their conversations"
  ON public.conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_messages.conversation_id
      AND (c.agent_a_id = auth.uid() OR c.agent_b_id = auth.uid())
    )
  );

CREATE POLICY "Agents can send messages in their conversations"
  ON public.conversation_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_agent_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_messages.conversation_id
      AND (c.agent_a_id = auth.uid() OR c.agent_b_id = auth.uid())
    )
  );

CREATE POLICY "Recipients can mark messages as read"
  ON public.conversation_messages FOR UPDATE
  USING (auth.uid() = recipient_agent_id);

-- Function to update conversation updated_at on new message
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- Trigger to update conversation timestamp
CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON public.conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_timestamp();