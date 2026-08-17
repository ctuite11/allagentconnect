-- listing_price_history: replace public insert with agent-owned insert
DROP POLICY IF EXISTS "Anyone can insert price history" ON public.listing_price_history;

CREATE POLICY "Listing agents can insert price history"
ON public.listing_price_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_price_history.listing_id
      AND public.matches_current_account(l.agent_id)
  )
);

CREATE POLICY "Service role manages price history"
ON public.listing_price_history
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

GRANT SELECT, INSERT ON public.listing_price_history TO authenticated;
GRANT ALL ON public.listing_price_history TO service_role;

-- listing_stats: remove public ALL write policy, keep public read
DROP POLICY IF EXISTS "System can manage listing stats" ON public.listing_stats;

CREATE POLICY "Listing agents can update their listing stats"
ON public.listing_stats
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_stats.listing_id
      AND public.matches_current_account(l.agent_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_stats.listing_id
      AND public.matches_current_account(l.agent_id)
  )
);

CREATE POLICY "Service role manages listing stats"
ON public.listing_stats
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.listing_stats FROM anon;
GRANT SELECT ON public.listing_stats TO anon;
GRANT SELECT, UPDATE ON public.listing_stats TO authenticated;
GRANT ALL ON public.listing_stats TO service_role;