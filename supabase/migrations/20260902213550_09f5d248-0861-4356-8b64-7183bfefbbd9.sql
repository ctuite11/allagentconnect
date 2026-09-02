CREATE OR REPLACE FUNCTION public.get_verified_agent_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id
  FROM public.agent_settings s
  JOIN auth.users u
    ON u.id = s.user_id
  JOIN public.user_roles r
    ON r.user_id = s.user_id
   AND r.role = 'agent'::public.app_role
  JOIN public.agent_profiles ap
    ON ap.id = s.user_id
  WHERE s.agent_status = 'verified'::public.agent_status
    AND (s.account_activated_at IS NOT NULL OR u.last_sign_in_at IS NOT NULL)
    AND s.hide_from_directory = false
    AND btrim(coalesce(ap.first_name, '')) <> ''
    AND btrim(coalesce(ap.last_name, '')) <> '';
$$;