-- Fix Critical Security Issue: Buyer Needs Data Exposure
-- Drop the vulnerable policy that allows all authenticated users to view buyer needs
DROP POLICY IF EXISTS "Authenticated users can view buyer needs" ON public.buyer_needs;

-- Create secure policy: Only submitter and matched agents can view
CREATE POLICY "Buyers and matched agents can view buyer needs" 
ON public.buyer_needs 
FOR SELECT 
USING (
  auth.uid() = submitted_by OR
  EXISTS (
    SELECT 1 FROM public.agent_county_preferences acp
    WHERE acp.agent_id = auth.uid() 
    AND acp.county_id = buyer_needs.county_id
  )
);

-- Fix handle_updated_at function to include security definer and search path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;