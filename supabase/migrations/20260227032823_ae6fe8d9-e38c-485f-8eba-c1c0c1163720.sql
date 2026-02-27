
-- 1) Create / Replace Trigger Function
CREATE OR REPLACE FUNCTION public.auto_create_conversation_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT NEW.id, uid
  FROM (
    SELECT NEW.agent_a_id AS uid
    UNION
    SELECT NEW.agent_b_id AS uid
  ) s
  WHERE uid IS NOT NULL
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2) Drop + Recreate Trigger
DROP TRIGGER IF EXISTS trg_auto_create_participants
ON public.conversations;

CREATE TRIGGER trg_auto_create_participants
AFTER INSERT ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_conversation_participants();

-- 3) Backfill Existing Conversations
INSERT INTO public.conversation_participants (conversation_id, user_id)
SELECT id, agent_a_id
FROM public.conversations
WHERE agent_a_id IS NOT NULL

UNION ALL

SELECT id, agent_b_id
FROM public.conversations
WHERE agent_b_id IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;
