-- ============================================================================
-- Step 3A POST-APPLY VERIFICATION (read-only)
-- Run after Lovable applies
--   20260804160000_step3a_activation_stamp_patricia_maria.sql
-- ============================================================================

-- 1) Exactly two repaired rows with stamps equal to redeemed_at
SELECT
  s.user_id,
  btrim(ap.first_name || ' ' || ap.last_name) AS name,
  ap.email,
  s.agent_status::text,
  s.account_activated_at,
  tok.redeemed_at,
  (s.account_activated_at IS NOT DISTINCT FROM tok.redeemed_at) AS matches_redeemed_at
FROM public.agent_settings s
JOIN public.agent_profiles ap ON ap.id = s.user_id
JOIN public.agent_activation_tokens tok
  ON tok.user_id = s.user_id
 AND tok.status = 'redeemed'
 AND tok.redeemed_at IS NOT DISTINCT FROM s.account_activated_at
WHERE s.user_id IN (
  'b01352e3-1cef-4289-8927-e2cecb666803',
  '7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca'
)
ORDER BY name;

-- 2) Both appear in corrected Network RPC
SELECT g.user_id
FROM public.get_verified_agent_ids() g
WHERE g.user_id IN (
  'b01352e3-1cef-4289-8927-e2cecb666803',
  '7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca'
)
ORDER BY g.user_id;

-- 3) Guard: the four excluded Group A accounts remain unactivated
SELECT
  s.user_id,
  btrim(ap.first_name || ' ' || ap.last_name) AS name,
  ap.email,
  s.account_activated_at
FROM public.agent_settings s
JOIN public.agent_profiles ap ON ap.id = s.user_id
WHERE lower(ap.email) IN (
  'kristingennetti@gmail.com',
  'shari.jacobson@cbrealty.com',
  'sheri.flagler@cbrealty.com',
  'steve.facelle@raveis.com'
)
ORDER BY name;
