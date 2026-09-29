CREATE OR REPLACE FUNCTION public.get_public_agent_profile(p_id_or_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', p.id, 'aac_id', p.aac_id, 'first_name', p.first_name, 'last_name', p.last_name,
    'title', p.title, 'company', p.company, 'office_name', p.office_name, 'team_name', p.team_name,
    'bio', p.bio, 'social_links', p.social_links,
    'buyer_incentives', p.buyer_incentives, 'seller_incentives', p.seller_incentives,
    'headshot_url', p.headshot_url, 'logo_url', p.logo_url,
    'header_background_type', p.header_background_type, 'header_background_value', p.header_background_value,
    'header_image_url', p.header_image_url, 'office_city', p.office_city, 'office_state', p.office_state,
    'created_at', p.created_at, 'updated_at', p.updated_at,
    'agent_county_preferences', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('county_id', acp.county_id,
               'counties', jsonb_build_object('name', c.name, 'state', c.state)))
      FROM public.agent_county_preferences acp
      LEFT JOIN public.counties c ON c.id = acp.county_id
      WHERE acp.agent_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.agent_profiles p
  WHERE (p_id_or_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND p.id = p_id_or_code::uuid)
     OR p.aac_id = p_id_or_code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_agent_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_agent_profile(text) TO anon, authenticated, service_role;