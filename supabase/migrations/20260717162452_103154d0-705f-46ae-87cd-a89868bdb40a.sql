CREATE OR REPLACE VIEW public.agent_presence AS
SELECT s.user_id, s.last_seen_at
FROM public.agent_settings s
WHERE s.agent_status = 'verified'::agent_status
  AND s.account_activated_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = s.user_id AND r.role = 'agent'::app_role
  );