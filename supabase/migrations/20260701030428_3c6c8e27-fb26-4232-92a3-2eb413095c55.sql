DROP POLICY IF EXISTS "Anyone can view published listings" ON public.listings;

CREATE POLICY "Anyone can view published listings"
ON public.listings
FOR SELECT
USING (
  status <> 'draft'
  OR auth.uid() = agent_id
);