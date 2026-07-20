
-- Step 3: Restrict anonymous PII exposure on agent_profiles
-- Create a public-safe view exposing only non-sensitive fields required by
-- public AAC pages (Our Agents directory, public Agent Profile, public property
-- pages). Excludes: email, phone, cell_phone, office_phone, office_address,
-- office_zip, receive_buyer_alerts, and any internal-only columns.

CREATE OR REPLACE VIEW public.agent_profiles_public
WITH (security_invoker = false, security_barrier = true) AS
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
  header_background_type,
  header_background_value,
  header_image_url,
  office_city,
  office_state,
  created_at,
  updated_at
FROM public.agent_profiles;

GRANT SELECT ON public.agent_profiles_public TO anon, authenticated;

-- Remove anonymous SELECT on the base table. Authenticated peer access is
-- preserved by the existing "Authenticated can view agent profiles" policy.
DROP POLICY IF EXISTS "Anon can view public agent columns" ON public.agent_profiles;
REVOKE SELECT ON public.agent_profiles FROM anon;
