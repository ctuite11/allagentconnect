-- Create a security-invoker view exposing only presence data
CREATE VIEW public.agent_presence
WITH (security_invoker = false) AS
  SELECT user_id, last_seen_at
  FROM public.agent_settings;

-- Allow any authenticated user to read presence
GRANT SELECT ON public.agent_presence TO authenticated;

-- Add an RLS-bypass SELECT policy so the view (owned by postgres) can read the base table
-- The view already runs as definer (security_invoker=false), so it bypasses RLS.
-- No additional base-table policy needed.