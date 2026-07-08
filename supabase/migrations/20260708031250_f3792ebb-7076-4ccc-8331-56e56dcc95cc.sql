
-- Narrow public-read policy on agent_settings for verified agents only.
-- Existing owner/admin policies remain untouched.
CREATE POLICY "Public can read verified agent directory fields"
ON public.agent_settings
FOR SELECT
TO anon, authenticated
USING (agent_status = 'verified'::agent_status);

-- Column-level grants: only the columns needed by the two views.
GRANT SELECT (user_id, agent_status) ON public.agent_settings TO anon;
GRANT SELECT (user_id, agent_status, last_seen_at) ON public.agent_settings TO authenticated;

-- Recreate views with security_invoker so they honor the caller's RLS.
ALTER VIEW public.agent_directory_status SET (security_invoker = on);

-- Restrict presence to verified agents only in this pass.
CREATE OR REPLACE VIEW public.agent_presence AS
SELECT user_id, last_seen_at
FROM public.agent_settings
WHERE agent_status = 'verified'::agent_status;

ALTER VIEW public.agent_presence SET (security_invoker = on);
