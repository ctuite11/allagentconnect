
-- Drop legacy SECURITY DEFINER view
DROP VIEW IF EXISTS public.agent_presence;

-- Narrowly scoped SECURITY DEFINER function: only exposes user_id + last_seen_at
-- for verified + activated agents. Does NOT expose any other agent_settings fields.
CREATE OR REPLACE FUNCTION public.get_agent_presence(user_ids uuid[])
RETURNS TABLE (user_id uuid, last_seen_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id, s.last_seen_at
  FROM public.agent_settings s
  WHERE s.user_id = ANY(user_ids)
    AND s.agent_status = 'verified'::agent_status
    AND s.account_activated_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = s.user_id AND r.role = 'agent'::app_role
    );
$$;

REVOKE ALL ON FUNCTION public.get_agent_presence(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_agent_presence(uuid[]) TO anon, authenticated, service_role;
