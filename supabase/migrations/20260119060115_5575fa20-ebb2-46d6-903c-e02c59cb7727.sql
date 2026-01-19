-- Seller Dashboard: Create seller-safe view for match data
-- Exposes only non-sensitive columns, RLS ensures seller can only see their own matches

-- 1) Create seller-safe view (excludes agent_id, delivery_id, admin-only fields)
CREATE OR REPLACE VIEW public.seller_matches_public
WITH (security_invoker = true) AS
SELECT 
  sm.id,
  sm.submission_id,
  sm.created_at,
  sm.latest_outcome,
  sm.latest_outcome_at,
  sm.next_followup_at,
  sm.archived_at
FROM public.seller_matches sm;

-- 2) Grant access to authenticated users (RLS will filter rows)
GRANT SELECT ON public.seller_matches_public TO authenticated;

-- 3) Add RLS policy so sellers can only see matches for their own submissions
-- First, create a helper function to check submission ownership
CREATE OR REPLACE FUNCTION public.owns_submission(p_submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.agent_match_submissions 
    WHERE id = p_submission_id 
    AND user_id = auth.uid()
  );
$$;

-- 4) Add seller SELECT policy to seller_matches (for view access)
-- Keep admin policies, add seller policy
DROP POLICY IF EXISTS "seller_matches_owner_select" ON public.seller_matches;
CREATE POLICY "seller_matches_owner_select"
ON public.seller_matches
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.owns_submission(submission_id)
);