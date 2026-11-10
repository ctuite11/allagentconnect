-- Read-only release verification after all privacy follow-up migrations.
-- Run as postgres after backend/application and private Storage checks.
-- This script does not reapply migrations or modify database state.
BEGIN READ ONLY;
DO $$
DECLARE s jsonb; names text[];
BEGIN
  s := public.migration_no_contact_status();
  IF s->>'target_project_ref' IS DISTINCT FROM 'kwfqjnepesiihjkdnxou'
    OR (s->>'database_locked')::boolean IS DISTINCT FROM true
    OR coalesce((s->>'changed_quarantined_routines')::int,-1) <> 0 THEN
    RAISE EXCEPTION 'Destination no-contact lock is not intact';
  END IF;
  SELECT array_agg(p.proname::text ORDER BY p.proname) INTO names FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace AND has_function_privilege('anon',p.oid,'EXECUTE');
  IF names IS DISTINCT FROM ARRAY['get_dcmls_agent_profile','get_dcmls_consumer_listings','get_dcmls_listing','get_dcmls_listing_agent',
    'get_delegate_invite_preview','get_hot_sheet_by_token','get_shared_hot_sheet',
    'get_shared_listing','get_verified_early_access_count','migration_no_contact_status','resolve_share_token'] THEN
    RAISE EXCEPTION 'Anonymous function allowlist differs: %', names;
  END IF;
  SELECT array_agg(c.relname::text ORDER BY c.relname) INTO names FROM pg_class c
    WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f')
      AND has_any_column_privilege('anon',c.oid,'SELECT');
  IF names IS DISTINCT FROM ARRAY['counties','dcmls_listings_public'] THEN RAISE EXCEPTION 'Anonymous column/table reads differ: %',names; END IF;
  IF has_schema_privilege('anon','aac_privacy','USAGE') OR has_schema_privilege('authenticated','aac_privacy','USAGE')
    OR has_any_column_privilege('authenticated','public.listing_share_links','SELECT')
    OR has_function_privilege('authenticated','public.get_dcmls_listing_photo_paths(uuid)','EXECUTE')
    OR has_function_privilege('anon','public.get_dcmls_listing_photo_paths(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.get_price_alert_context(uuid,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.get_price_alert_context(uuid,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.privacy_email_delivery_allowed(jsonb,text[])','EXECUTE')
    OR has_function_privilege('authenticated','public.enqueue_hot_sheet_delivery(uuid,uuid,text,uuid,text,text,jsonb,text,boolean,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Private implementation/system-only grant escaped';
  END IF;
  IF has_any_column_privilege('authenticated','public.agent_messages','INSERT')
    OR has_any_column_privilege('authenticated','public.showing_requests','INSERT')
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.client_agent_relationships'::regclass
      AND tgname='privacy_bind_relationship_recipient' AND tgenabled='O')
    OR (SELECT count(*) FROM pg_policy WHERE NOT polpermissive AND (
      (polrelid='public.client_agent_relationships'::regclass AND polname='privacy_relationship_insert')
      OR (polrelid='public.agent_messages'::regclass AND polname='privacy_inquiry_insert')
      OR (polrelid='public.showing_requests'::regclass AND polname='privacy_showing_insert'))) <> 3 THEN
    RAISE EXCEPTION 'Recipient/persistence write boundaries are incomplete';
  END IF;
  IF (SELECT count(*) FROM storage.buckets WHERE id IN
    ('listing-photos','listing-floorplans','agent-match-photos','email-attachments') AND public=false) <> 4 THEN
    RAISE EXCEPTION 'Confidential bucket API cutover is incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('agent-headshots','agent-logos','brand-assets') AND public<>true) THEN
    RAISE EXCEPTION 'A public branding bucket is private; review without reopening confidential buckets';
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid='storage.objects'::regclass
    AND polname IN ('privacy_confidential_storage_anon','privacy_confidential_storage_read') AND NOT polpermissive) <> 2 THEN
    RAISE EXCEPTION 'Restrictive Storage policies are missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE '%\_\_ungated') THEN
    RAISE EXCEPTION 'An obsolete exposed implementation remains';
  END IF;
END $$;
SELECT 'PRIVACY_CATALOG_AND_STORAGE_FLAGS_PASS_DELIVERY_STILL_LOCKED' AS result;
SELECT public.migration_no_contact_status();
COMMIT;
