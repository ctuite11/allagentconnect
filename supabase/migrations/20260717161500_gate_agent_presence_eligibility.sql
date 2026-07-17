-- Presence eligibility: Online requires agent role + verified + activated.
--
-- agent_presence previously exposed every verified agent_settings row, so a
-- verified-but-never-activated account (account_activated_at IS NULL) or a
-- row without the agent role could still render as Online off a recent
-- heartbeat. Filter at the source so every consumer (desktop and mobile)
-- inherits the rule and stale last_seen_at values on ineligible accounts
-- can never paint them green.
--
-- has_role() is SECURITY DEFINER, so the role check works under
-- security_invoker without widening user_roles RLS.

GRANT SELECT (user_id, agent_status, last_seen_at, account_activated_at)
  ON public.agent_settings TO authenticated;

CREATE OR REPLACE VIEW public.agent_presence AS
SELECT s.user_id,
       s.last_seen_at
FROM public.agent_settings s
WHERE s.agent_status = 'verified'::agent_status
  AND s.account_activated_at IS NOT NULL
  AND public.has_role(s.user_id, 'agent'::app_role);

ALTER VIEW public.agent_presence SET (security_invoker = on);
