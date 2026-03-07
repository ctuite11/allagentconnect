-- Drop the restrictive SELECT policy and replace with one that covers all visible statuses
DROP POLICY "Anyone can view active listings" ON public.listings;

CREATE POLICY "Anyone can view published listings"
  ON public.listings
  FOR SELECT
  USING (
    status IN (
      'active', 'new', 'coming_soon', 'off_market',
      'back_on_market', 'price_changed', 'extended', 'reactivated',
      'under_agreement', 'pending', 'contingent', 'sold', 'rented'
    )
    OR auth.uid() = agent_id
  );