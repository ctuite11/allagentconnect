
-- Recreate the public view as SECURITY INVOKER (caller's privileges + RLS)
DROP VIEW IF EXISTS public.agent_profiles_public;

CREATE VIEW public.agent_profiles_public
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  id, aac_id, first_name, last_name, title, company, office_name, team_name,
  bio, social_links, buyer_incentives, seller_incentives,
  headshot_url, logo_url, header_background_type, header_background_value, header_image_url,
  office_city, office_state, created_at, updated_at
FROM public.agent_profiles;

GRANT SELECT ON public.agent_profiles_public TO anon, authenticated;

-- Restore an anon SELECT policy on the base table (RLS still requires a policy
-- for anon to read anything). PostgREST also requires GRANT — grant anon only
-- the public-safe columns so PII columns (email, phone, cell_phone, office_phone,
-- office_address, office_zip, receive_buyer_alerts, and any internal columns)
-- remain unreadable to anonymous callers.
CREATE POLICY "Anon can view agent profiles (public columns only)"
  ON public.agent_profiles
  FOR SELECT
  TO anon
  USING (true);

GRANT SELECT (
  id, aac_id, first_name, last_name, title, company, office_name, team_name,
  bio, social_links, buyer_incentives, seller_incentives,
  headshot_url, logo_url, header_background_type, header_background_value, header_image_url,
  office_city, office_state, created_at, updated_at
) ON public.agent_profiles TO anon;
