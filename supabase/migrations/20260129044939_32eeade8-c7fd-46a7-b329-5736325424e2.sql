-- ============================================
-- FIX: conversation_inbox view + tightened RLS
-- ============================================

-- 1) Create conversation_inbox view for efficient unread/preview queries
CREATE OR REPLACE VIEW public.conversation_inbox
WITH (security_invoker = on)
AS
SELECT
  c.id AS conversation_id,
  c.last_message_at,
  cp.last_read_at,
  lm.body AS last_message_preview,
  lm.sender_agent_id AS last_message_sender_id,
  (
    c.last_message_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
    AND lm.sender_agent_id IS DISTINCT FROM cp.user_id
  ) AS is_unread,
  -- Include other user info for thread display
  CASE 
    WHEN c.agent_a_id = cp.user_id THEN c.agent_b_id
    ELSE c.agent_a_id
  END AS other_user_id,
  c.listing_id,
  c.buyer_need_id
FROM public.conversations c
JOIN public.conversation_participants cp
  ON cp.conversation_id = c.id
LEFT JOIN LATERAL (
  SELECT m.body, m.sender_agent_id
  FROM public.conversation_messages m
  WHERE m.conversation_id = c.id
  ORDER BY m.created_at DESC
  LIMIT 1
) lm ON true
WHERE cp.user_id = auth.uid();

-- 2) Tighten RLS for conversation_participants INSERT
-- Users can only insert rows for themselves
DROP POLICY IF EXISTS "cp_insert_auth" ON public.conversation_participants;
CREATE POLICY "cp_insert_self"
ON public.conversation_participants FOR INSERT
WITH CHECK (user_id = auth.uid());

-- 3) Grant SELECT on view to authenticated users
GRANT SELECT ON public.conversation_inbox TO authenticated;