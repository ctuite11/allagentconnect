
REVOKE SELECT ON public.agent_settings FROM anon;
REVOKE SELECT ON public.agent_settings FROM authenticated;

GRANT SELECT (user_id, agent_status) ON public.agent_settings TO anon;
GRANT SELECT (user_id, agent_status, last_seen_at) ON public.agent_settings TO authenticated;

-- Owners/admins need broader SELECT for their own rows; grant full column SELECT to authenticated for remaining columns via role, gated by RLS policies.
GRANT SELECT ON public.agent_settings TO authenticated;
