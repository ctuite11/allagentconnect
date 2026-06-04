CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.conversation_participants
  SET is_archived = false
  WHERE conversation_id = NEW.conversation_id
    AND user_id IN (NEW.sender_agent_id, NEW.recipient_agent_id);

  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;