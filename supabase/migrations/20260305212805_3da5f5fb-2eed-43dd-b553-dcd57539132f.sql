
-- Function: get listing interest signals for an agent's network
-- Returns saves count, comments count, and hot sheet match count per listing
CREATE OR REPLACE FUNCTION public.get_listing_interest_signals(
  p_agent_id uuid,
  p_listing_ids uuid[]
)
RETURNS TABLE (
  listing_id uuid,
  saves_count bigint,
  comments_count bigint,
  hotsheet_match_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH agent_client_ids AS (
    -- CRM clients belonging to this agent
    SELECT c.id AS client_id
    FROM public.clients c
    WHERE c.agent_id = p_agent_id
  ),
  agent_client_user_ids AS (
    -- Auth user IDs of clients with active relationships to this agent
    SELECT car.client_id AS user_id
    FROM public.client_agent_relationships car
    WHERE car.agent_id = p_agent_id
      AND car.status = 'active'
  ),
  saves AS (
    SELECT f.listing_id, COUNT(*) AS cnt
    FROM public.favorites f
    WHERE f.listing_id = ANY(p_listing_ids)
      AND f.user_id IN (SELECT user_id FROM agent_client_user_ids)
    GROUP BY f.listing_id
  ),
  comments AS (
    SELECT hsc.listing_id, COUNT(DISTINCT hsc.sender_id) AS cnt
    FROM public.hot_sheet_comments hsc
    JOIN public.hot_sheets hs ON hs.id = hsc.hot_sheet_id
    WHERE hsc.listing_id = ANY(p_listing_ids)
      AND hs.user_id = p_agent_id
      AND hsc.sender_role = 'client'
    GROUP BY hsc.listing_id
  ),
  hs_matches AS (
    SELECT hsl.listing_id, COUNT(DISTINCT hsl.hot_sheet_id) AS cnt
    FROM public.hot_sheet_sent_listings hsl
    JOIN public.hot_sheets hs ON hs.id = hsl.hot_sheet_id
    WHERE hsl.listing_id = ANY(p_listing_ids)
      AND hs.user_id = p_agent_id
    GROUP BY hsl.listing_id
  ),
  all_listings AS (
    SELECT unnest(p_listing_ids) AS lid
  )
  SELECT
    al.lid AS listing_id,
    COALESCE(s.cnt, 0) AS saves_count,
    COALESCE(c.cnt, 0) AS comments_count,
    COALESCE(h.cnt, 0) AS hotsheet_match_count
  FROM all_listings al
  LEFT JOIN saves s ON s.listing_id = al.lid
  LEFT JOIN comments c ON c.listing_id = al.lid
  LEFT JOIN hs_matches h ON h.listing_id = al.lid
  WHERE COALESCE(s.cnt, 0) + COALESCE(c.cnt, 0) + COALESCE(h.cnt, 0) > 0;
$$;
