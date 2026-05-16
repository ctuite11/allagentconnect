-- Per-user inbox hide: conversation_inbox excludes archived participant rows.
DROP VIEW IF EXISTS public.conversation_inbox;

CREATE VIEW public.conversation_inbox AS
SELECT c.id AS conversation_id,
    c.last_message_at,
    cp.last_read_at,
    lm.body AS last_message_preview,
    lm.sender_agent_id AS last_message_sender_id,
    c.last_message_at > COALESCE(cp.last_read_at, '1970-01-01 00:00:00+00'::timestamp with time zone)
      AND lm.sender_agent_id IS DISTINCT FROM cp.user_id AS is_unread,
    COALESCE(uc.cnt, 0) AS unread_count,
    CASE
        WHEN c.agent_a_id = cp.user_id THEN c.agent_b_id
        ELSE c.agent_a_id
    END AS other_user_id,
    c.listing_id,
    c.buyer_need_id
FROM conversations c
JOIN conversation_participants cp ON cp.conversation_id = c.id
LEFT JOIN LATERAL (
    SELECT m.body, m.sender_agent_id
    FROM conversation_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
) lm ON true
LEFT JOIN LATERAL (
    SELECT count(*)::int AS cnt
    FROM conversation_messages m2
    WHERE m2.conversation_id = c.id
      AND m2.sender_agent_id IS DISTINCT FROM cp.user_id
      AND m2.created_at > COALESCE(cp.last_read_at, '1970-01-01 00:00:00+00'::timestamp with time zone)
) uc ON true
WHERE cp.user_id = auth.uid()
  AND cp.is_archived = false;
