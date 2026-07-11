-- Remove full-row public exposure of agent_settings.
-- The public agent directory reads verified agent IDs through the
-- SECURITY DEFINER function public.get_verified_agent_ids(), which returns
-- only user_id. No frontend query selects columns from agent_settings as
-- anon; owners and admins retain access via their own policies.
DROP POLICY IF EXISTS "Public can read verified agent directory fields" ON public.agent_settings;