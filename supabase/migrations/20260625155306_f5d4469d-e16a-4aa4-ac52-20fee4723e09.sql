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
         ap.office_city, ap.office_state, aset.verified_at
  FROM public.agent_settings aset
  JOIN public.agent_profiles ap ON ap.id = aset.user_id
  WHERE aset.agent_status = 'verified'
    AND aset.hide_from_directory = false
    AND ap.first_name IS NOT NULL
    AND ap.last_name IS NOT NULL
    AND btrim(ap.first_name) <> ''
    AND btrim(ap.last_name) <> ''
    AND ap.headshot_url IS NOT NULL
    AND btrim(ap.headshot_url) <> ''
  ORDER BY aset.verified_at DESC NULLS LAST, ap.created_at DESC
  LIMIT GREATEST(COALESCE(_limit, 12), 1)
$$;