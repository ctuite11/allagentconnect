-- Incident-response control for external listing access.
-- Excluded from routine deployment. Keeps confidential buckets, delivery
-- controls and listing authorization records intact.
BEGIN;
DO $$ BEGIN
  IF public.migration_no_contact_status()->>'target_project_ref' IS DISTINCT FROM 'kwfqjnepesiihjkdnxou' THEN
    RAISE EXCEPTION 'Wrong project; nothing changed';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION aac_privacy.external_allowed(p_listing_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT false; $$;
REVOKE ALL ON FUNCTION aac_privacy.external_allowed(uuid) FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
-- All guest/buyer listing reads, fresh photo issuance and external listing-mail
-- checks now fail closed. Previously downloaded/cached bytes cannot be recalled.
-- External access may be restored only after an approved repair and
-- verification. Review potentially compromised links separately.
