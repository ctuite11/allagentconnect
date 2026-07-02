
-- Phase 1: extend public.pending_verifications for unified onboarding foundation.
-- Purely additive. Table currently has 0 rows and no FKs on user_id.

-- 1. Relax user_id (leads have no auth user yet)
ALTER TABLE public.pending_verifications
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. New columns
ALTER TABLE public.pending_verifications
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS license_last_name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS turnstile_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_user_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3. Status domain check
ALTER TABLE public.pending_verifications
  DROP CONSTRAINT IF EXISTS pending_verifications_status_check;
ALTER TABLE public.pending_verifications
  ADD CONSTRAINT pending_verifications_status_check
  CHECK (status IN ('pending','verified','rejected','duplicate'));

-- 4. One open pending request per email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS pending_verifications_open_email_uidx
  ON public.pending_verifications (lower(email))
  WHERE status = 'pending';

-- 5. updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pending_verifications_set_updated_at ON public.pending_verifications;
CREATE TRIGGER pending_verifications_set_updated_at
  BEFORE UPDATE ON public.pending_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. GRANTs (revoke then re-grant intentionally)
REVOKE ALL ON public.pending_verifications FROM anon, authenticated;
GRANT INSERT ON public.pending_verifications TO anon;
GRANT SELECT ON public.pending_verifications TO authenticated;
GRANT ALL ON public.pending_verifications TO service_role;

-- 7. RLS: replace old "Users can insert their own pending verification"
--    policy (assumed non-null user_id) with an anon-insert policy scoped
--    to freshly submitted leads (status='pending', user_id IS NULL).
ALTER TABLE public.pending_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own pending verification" ON public.pending_verifications;

DROP POLICY IF EXISTS pending_verifications_insert_anon ON public.pending_verifications;
CREATE POLICY pending_verifications_insert_anon
  ON public.pending_verifications
  FOR INSERT TO anon
  WITH CHECK (status = 'pending' AND user_id IS NULL);

-- Keep existing admin SELECT/UPDATE policies intact.
-- No authenticated UPDATE/DELETE policy: all mutations go through
-- edge functions running as service_role.
