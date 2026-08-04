-- ============================================================================
-- Agent Network containment: require real account activation.
--
-- Removes the invalid company fallback from:
--   public.get_verified_agent_ids()
--   public.get_newest_verified_agents(int)
--
-- Company can be collected on the access-request form and copied into
-- agent_profiles before the agent sets a password / completes setup. That is
-- not proof of activation.
--
-- This migration:
--   * redefines both RPCs only
--   * does NOT update any agent rows
--   * does NOT backfill account_activated_at
--   * does NOT send email
-- ============================================================================

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
    AND s.account_activated_at IS NOT NULL
    AND s.hide_from_directory = false
    AND btrim(coalesce(ap.first_name, '')) <> ''
    AND btrim(coalesce(ap.last_name, '')) <> '';
$$;

CREATE OR REPLACE FUNCTION public.get_newest_verified_agents(_limit int DEFAULT 12)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  company text,
  headshot_url text,
  office_city text,
  office_state text,
  verified_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ap.id, ap.first_name, ap.last_name, ap.company, ap.headshot_url,
         ap.office_city, ap.office_state, s.verified_at
  FROM public.agent_settings s
  JOIN auth.users u
    ON u.id = s.user_id
  JOIN public.user_roles r
    ON r.user_id = s.user_id
   AND r.role = 'agent'::public.app_role
  JOIN public.agent_profiles ap
    ON ap.id = s.user_id
  WHERE s.agent_status = 'verified'::public.agent_status
    AND s.account_activated_at IS NOT NULL
    AND s.hide_from_directory = false
    AND btrim(coalesce(ap.first_name, '')) <> ''
    AND btrim(coalesce(ap.last_name, '')) <> ''
  ORDER BY GREATEST(
             COALESCE(s.account_activated_at, 'epoch'::timestamptz),
             COALESCE(s.verified_at,          'epoch'::timestamptz),
             COALESCE(ap.created_at,          'epoch'::timestamptz)
           ) DESC,
           s.verified_at DESC NULLS LAST,
           ap.created_at DESC
  LIMIT GREATEST(COALESCE(_limit, 12), 1);
$$;

-- Preserve current execute grants (anon + authenticated; service_role keeps default).
GRANT EXECUTE ON FUNCTION public.get_verified_agent_ids() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_newest_verified_agents(int) TO anon, authenticated;