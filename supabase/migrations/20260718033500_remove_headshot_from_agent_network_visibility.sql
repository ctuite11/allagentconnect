-- Agent Network visibility no longer requires a profile photo.
--
-- Setup eligibility remains:
--   * verified + activated, OR
--   * verified + rescue setup fields complete (first name, last name, brokerage)
--
-- Both cohorts must hold the agent role, remain directory-visible, and have a
-- usable name. Missing headshots are rendered by the frontend's gray initials
-- fallback rather than filtering the agent out.

CREATE OR REPLACE FUNCTION public.get_verified_agent_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.user_id
  FROM public.agent_settings s
  JOIN public.agent_profiles ap ON ap.id = s.user_id
  WHERE s.agent_status = 'verified'::agent_status
    AND s.hide_from_directory = false
    AND public.has_role(s.user_id, 'agent'::app_role)
    AND btrim(coalesce(ap.first_name, '')) <> ''
    AND btrim(coalesce(ap.last_name, '')) <> ''
    AND (
      s.account_activated_at IS NOT NULL
      OR btrim(coalesce(ap.company, '')) <> ''
    );
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
  JOIN public.agent_profiles ap ON ap.id = s.user_id
  WHERE s.agent_status = 'verified'::agent_status
    AND s.hide_from_directory = false
    AND public.has_role(s.user_id, 'agent'::app_role)
    AND btrim(coalesce(ap.first_name, '')) <> ''
    AND btrim(coalesce(ap.last_name, '')) <> ''
    AND (
      s.account_activated_at IS NOT NULL
      OR btrim(coalesce(ap.company, '')) <> ''
    )
  ORDER BY s.verified_at DESC NULLS LAST, ap.created_at DESC
  LIMIT GREATEST(COALESCE(_limit, 12), 1);
$$;
