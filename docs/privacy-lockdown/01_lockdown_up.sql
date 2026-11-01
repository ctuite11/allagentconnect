-- PRIVACY LOCKDOWN (STAGED - NOT APPLIED). Requires Chris's explicit approval before production.
-- 1) Signed-out visitors lose all access to network listing/agent views and lookups.
-- 2) Signed-in users get data only when public.is_verified_agent() is true.
-- 3) Hidden / non-verified agents are never returned by agent lookups.
-- Original function bodies are preserved as <name>__ungated (no grants) for an exact rollback.

CREATE TABLE IF NOT EXISTS public.privacy_lockdown_backup (
  object_name text PRIMARY KEY, definition text NOT NULL, saved_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.privacy_lockdown_backup FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.privacy_lockdown_backup TO service_role;
ALTER TABLE public.privacy_lockdown_backup ENABLE ROW LEVEL SECURITY;

-- Views -------------------------------------------------------------------
DO $$
DECLARE v text; def text;
BEGIN
  FOREACH v IN ARRAY ARRAY['listings_public','dcmls_listings_public'] LOOP
    def := rtrim(pg_get_viewdef(('public.'||v)::regclass, true), E'; \n');
    INSERT INTO public.privacy_lockdown_backup(object_name, definition) VALUES ('view:'||v, def)
      ON CONFLICT (object_name) DO NOTHING;
    EXECUTE format('CREATE OR REPLACE VIEW public.%I WITH (security_invoker=false) AS %s AND public.is_verified_agent()', v, def);
  END LOOP;
END $$;
REVOKE ALL ON public.listings_public, public.dcmls_listings_public, public.seller_matches_public FROM PUBLIC, anon;
GRANT SELECT ON public.listings_public, public.dcmls_listings_public, public.seller_matches_public TO authenticated;
GRANT SELECT ON public.listings_public, public.dcmls_listings_public, public.seller_matches_public TO service_role;

-- Functions ---------------------------------------------------------------
DO $$
DECLARE
  r record; args_call text; gate text; body text; is_scalar boolean;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_arguments(p.oid) AS full_args,
           pg_get_function_identity_arguments(p.oid) AS id_args,
           pg_get_function_result(p.oid) AS result, p.proretset, p.proargnames
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('get_public_agent_profile','get_public_listing','get_public_listing_agent',
                        'get_verified_agent_ids','get_newest_verified_agents','get_agent_presence',
                        'get_listing_interest_signals','listings_within_radius','get_dcmls_listing')
  LOOP
    SELECT coalesce(string_agg(quote_ident(n), ', ' ORDER BY i), '') INTO args_call
      FROM unnest(r.proargnames) WITH ORDINALITY AS t(n, i)
      WHERE i <= (SELECT pronargs FROM pg_proc WHERE oid = r.oid);
    EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', r.proname, r.id_args, r.proname||'__ungated');
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname||'__ungated', r.id_args);
    is_scalar := NOT r.proretset AND r.result NOT LIKE 'TABLE(%';
    gate := 'public.is_verified_agent()';
    IF r.proname = 'get_public_agent_profile' THEN
      body := format($b$SELECT x.r FROM (SELECT public.%I(%s) AS r) x
        WHERE %s AND x.r IS NOT NULL AND EXISTS (SELECT 1 FROM public.agent_settings s
          WHERE s.user_id = (x.r->>'id')::uuid AND s.agent_status = 'verified'
            AND (coalesce(s.hide_from_directory,false) = false OR s.user_id = auth.uid()))$b$,
        r.proname||'__ungated', args_call, gate);
    ELSIF r.proname = 'get_public_listing_agent' THEN
      body := format($b$SELECT f.* FROM public.%I(%s) f WHERE %s AND EXISTS (SELECT 1 FROM public.agent_settings s
          WHERE s.user_id = f.agent_id AND s.agent_status = 'verified')$b$, r.proname||'__ungated', args_call, gate);
    ELSIF r.proname IN ('get_newest_verified_agents') THEN
      body := format($b$SELECT f.* FROM public.%I(%s) f WHERE %s AND EXISTS (SELECT 1 FROM public.agent_settings s
          WHERE s.user_id = f.id AND s.agent_status = 'verified' AND coalesce(s.hide_from_directory,false) = false)$b$,
        r.proname||'__ungated', args_call, gate);
    ELSIF r.proname = 'get_verified_agent_ids' THEN
      body := format($b$SELECT f.* FROM public.%I(%s) f WHERE %s AND EXISTS (SELECT 1 FROM public.agent_settings s
          WHERE s.user_id = f.user_id AND s.agent_status = 'verified' AND coalesce(s.hide_from_directory,false) = false)$b$,
        r.proname||'__ungated', args_call, gate);
    ELSIF is_scalar THEN
      body := format('SELECT public.%I(%s) WHERE %s', r.proname||'__ungated', args_call, gate);
    ELSE
      body := format('SELECT f.* FROM public.%I(%s) f WHERE %s', r.proname||'__ungated', args_call, gate);
    END IF;
    EXECUTE format('CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS %L',
      r.proname, r.full_args, r.result, body);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.id_args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.id_args);
  END LOOP;
END $$;
