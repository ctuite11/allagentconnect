
-- Drop existing anon SELECT policy and column grants on base table
DROP POLICY IF EXISTS "Anon can view agent profiles (public columns only)" ON public.agent_profiles;
REVOKE SELECT ON public.agent_profiles FROM anon;

-- Public-safe view (runs as owner so anon can read it without a base-table policy)
DROP VIEW IF EXISTS public.agent_profiles_public;
CREATE VIEW public.agent_profiles_public
WITH (security_invoker = false) AS
SELECT
  id,
  aac_id,
  first_name,
  last_name,
  title,
  company,
  office_name,
  team_name,
  bio,
  social_links,
  buyer_incentives,
  seller_incentives,
  headshot_url,
  logo_url,
  office_address,
  office_city,
  office_state,
  office_zip,
  header_background_type,
  header_background_value,
  header_image_url,
  created_at,
  updated_at
FROM public.agent_profiles;

GRANT SELECT ON public.agent_profiles_public TO anon, authenticated;
