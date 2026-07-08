-- Replace the wide-open SELECT policy with role-scoped policies.
DROP POLICY IF EXISTS "Anyone can view agent profiles" ON public.agent_profiles;

CREATE POLICY "Authenticated can view agent profiles"
  ON public.agent_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can view public agent columns"
  ON public.agent_profiles FOR SELECT TO anon USING (true);

-- Enforce PII hiding at the privilege layer.
REVOKE SELECT ON public.agent_profiles FROM anon;
GRANT SELECT (
  id, aac_id, first_name, last_name, title, company, office_name, team_name,
  bio, social_links, buyer_incentives, seller_incentives, headshot_url,
  logo_url, header_background_type, header_background_value, header_image_url,
  office_city, office_state, office_zip, receive_buyer_alerts,
  created_at, updated_at
) ON public.agent_profiles TO anon;