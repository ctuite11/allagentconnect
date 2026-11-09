-- ROLLBACK (STAGED). Restores original behaviour for SIGNED-IN users only.
-- Deliberately does NOT re-grant anything to anon: rolling back must not reopen private data to the public.
DO $$
DECLARE r record; real_name text;
BEGIN
  FOR r IN SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS id_args
           FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname LIKE '%\_\_ungated' LOOP
    real_name := left(r.proname, length(r.proname) - length('__ungated'));
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s)', real_name, r.id_args);
    EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', r.proname, r.id_args, real_name);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', real_name, r.id_args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', real_name, r.id_args);
  END LOOP;
  FOR r IN SELECT object_name, definition FROM public.privacy_lockdown_backup WHERE object_name LIKE 'view:%' LOOP
    EXECUTE format('CREATE OR REPLACE VIEW public.%I WITH (security_invoker=false) AS %s', substr(r.object_name, 6), r.definition);
  END LOOP;
END $$;
REVOKE ALL ON public.listings_public, public.dcmls_listings_public, public.seller_matches_public FROM PUBLIC, anon;
GRANT SELECT ON public.listings_public, public.dcmls_listings_public, public.seller_matches_public TO authenticated, service_role;
