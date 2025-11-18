-- Add RLS policy to allow agents to delete their own draft listings
CREATE POLICY "Agents can delete their own draft listings"
ON public.listings
FOR DELETE
USING (
  auth.uid() = agent_id 
  AND status = 'draft'
);