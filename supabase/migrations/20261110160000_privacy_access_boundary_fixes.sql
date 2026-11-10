-- Recipient identity, inquiry persistence and price-alert delivery boundaries.
-- Requires the base privacy and workflow repair migrations. Apply once.
-- Does not enable email, notifications, cron, social delivery or public buckets.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.get_dcmls_listing_photo_paths(uuid)') IS NULL
    OR to_regclass('aac_privacy.original_functions') IS NULL THEN
    RAISE EXCEPTION 'The base privacy and workflow repair migrations are required';
  END IF;
END $$;

-- A caller cannot create representation with another agent by setting client_id.
DROP POLICY IF EXISTS privacy_relationship_insert ON public.client_agent_relationships;
CREATE POLICY privacy_relationship_insert ON public.client_agent_relationships AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (public.can_act_for_agent(agent_id) AND (crm_client_id IS NULL OR EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = crm_client_id AND c.agent_id = client_agent_relationships.agent_id))));

-- Persist validated account identity so a later Auth email change does not
-- disconnect a legitimate member. Never adopt a mismatched legacy relationship.
CREATE OR REPLACE FUNCTION aac_privacy.bind_relationship_recipient()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status='active' AND NEW.ended_at IS NULL AND NEW.client_id IS NOT NULL AND NEW.crm_client_id IS NOT NULL THEN
    UPDATE public.clients c SET agent_user_id=NEW.client_id
      FROM auth.users u WHERE c.id=NEW.crm_client_id AND c.agent_id=NEW.agent_id
        AND c.agent_user_id IS NULL AND u.id=NEW.client_id AND u.email_confirmed_at IS NOT NULL
        AND lower(btrim(c.email))=lower(btrim(u.email));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS privacy_bind_relationship_recipient ON public.client_agent_relationships;
CREATE TRIGGER privacy_bind_relationship_recipient AFTER INSERT OR UPDATE OF client_id,crm_client_id,status,ended_at
  ON public.client_agent_relationships FOR EACH ROW EXECUTE FUNCTION aac_privacy.bind_relationship_recipient();
UPDATE public.clients c SET agent_user_id=r.client_id FROM public.client_agent_relationships r,auth.users u
  WHERE c.id=r.crm_client_id AND c.agent_id=r.agent_id AND c.agent_user_id IS NULL
    AND r.status='active' AND r.ended_at IS NULL AND u.id=r.client_id AND u.email_confirmed_at IS NOT NULL
    AND lower(btrim(c.email))=lower(btrim(u.email));

-- This explicit recipient helper is private; service notifications and the
-- authenticated membership RPC use the same authority without impersonation.
CREATE OR REPLACE FUNCTION aac_privacy.is_hot_sheet_recipient(p_user_id uuid, p_hot_sheet_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.hot_sheets h WHERE h.id=p_hot_sheet_id AND (
    EXISTS (SELECT 1 FROM public.client_agent_relationships r
      JOIN public.clients c ON c.id=r.crm_client_id AND c.agent_id=h.user_id
      JOIN auth.users u ON u.id=r.client_id
      WHERE r.client_id=p_user_id AND r.agent_id=h.user_id AND r.status='active' AND r.ended_at IS NULL
        AND (c.agent_user_id=p_user_id OR (u.email_confirmed_at IS NOT NULL AND lower(btrim(c.email))=lower(btrim(u.email))))
        AND (c.id=h.client_id OR EXISTS (SELECT 1 FROM public.hot_sheet_clients hc WHERE hc.hot_sheet_id=h.id AND hc.client_id=c.id)))
    OR EXISTS (SELECT 1 FROM public.share_tokens st WHERE st.agent_id=h.user_id
      AND st.accepted_at IS NOT NULL AND st.accepted_by_user_id=p_user_id AND st.revoked_at IS NULL
      AND (st.expires_at IS NULL OR st.expires_at>now()) AND st.payload->>'type'='client_hotsheet_invite'
      AND coalesce(st.payload->>'hot_sheet_id',st.payload->>'hotSheetId',st.payload->>'hotsheetId')=h.id::text)));
$$;

CREATE OR REPLACE FUNCTION public.is_hot_sheet_participant(p_hot_sheet_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.hot_sheets h WHERE h.id=p_hot_sheet_id AND (
    public.has_role(auth.uid(),'admin'::public.app_role) OR public.matches_current_account(h.user_id)
    OR aac_privacy.is_hot_sheet_recipient(auth.uid(),h.id)));
$$;

CREATE OR REPLACE FUNCTION public.can_authenticated_buyer_view_hot_sheet_client(p_hot_sheet_id uuid, p_crm_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.hot_sheets h JOIN public.clients c ON c.agent_id=h.user_id
    WHERE h.id=p_hot_sheet_id AND c.id=p_crm_client_id
      AND (h.client_id=c.id OR EXISTS (SELECT 1 FROM public.hot_sheet_clients hc WHERE hc.hot_sheet_id=h.id AND hc.client_id=c.id))
      AND (EXISTS (SELECT 1 FROM public.client_agent_relationships r JOIN auth.users u ON u.id=r.client_id
        WHERE r.agent_id=h.user_id AND r.client_id=auth.uid() AND r.status='active' AND r.ended_at IS NULL
          AND r.crm_client_id=c.id AND (c.agent_user_id=auth.uid()
            OR (u.email_confirmed_at IS NOT NULL AND lower(btrim(c.email))=lower(btrim(u.email)))))
        OR EXISTS (SELECT 1 FROM public.share_tokens st WHERE st.agent_id=h.user_id
          AND st.accepted_by_user_id=auth.uid() AND st.accepted_at IS NOT NULL AND st.revoked_at IS NULL
          AND (st.expires_at IS NULL OR st.expires_at>now()) AND st.payload->>'type'='client_hotsheet_invite'
          AND coalesce(st.payload->>'hot_sheet_id',st.payload->>'hotSheetId',st.payload->>'hotsheetId')=h.id::text
          AND (st.payload->>'client_id'=c.id::text OR lower(st.payload->>'client_email')=lower(c.email)))));
$$;

-- Preserve activation's one-agent/idempotency behavior behind a recipient check.
DO $migration$
DECLARE definition text;
BEGIN
  IF to_regprocedure('aac_privacy.activate_agent_relationship(uuid,uuid)') IS NULL THEN
    SELECT pg_get_functiondef('public.activate_agent_relationship(uuid,uuid)'::regprocedure) INTO definition;
    INSERT INTO aac_privacy.original_functions(signature,definition)
      VALUES ('public.activate_agent_relationship(_agent_id uuid, _crm_client_id uuid)',definition) ON CONFLICT DO NOTHING;
    EXECUTE replace(definition,'FUNCTION public.activate_agent_relationship(', 'FUNCTION aac_privacy.activate_agent_relationship(');
  END IF;
END $migration$;

-- The one-argument overload already supplies NULL. Remove the overlapping
-- default from the two-argument overload to keep single-argument calls unambiguous.
-- No CASCADE: unexpected external dependencies abort the transaction safely.
DROP FUNCTION public.activate_agent_relationship(uuid,uuid);
CREATE FUNCTION public.activate_agent_relationship(_agent_id uuid, _crm_client_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE contact_id uuid; caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR NOT EXISTS (SELECT 1 FROM public.agent_settings s WHERE s.user_id=_agent_id AND s.agent_status='verified') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  SELECT c.id INTO contact_id FROM public.clients c JOIN auth.users u ON u.id=caller
    WHERE c.agent_id=_agent_id AND (_crm_client_id IS NULL OR c.id=_crm_client_id)
      AND (c.agent_user_id=caller OR (u.email_confirmed_at IS NOT NULL AND lower(btrim(c.email))=lower(btrim(u.email))))
    ORDER BY c.created_at DESC,c.id LIMIT 1;
  IF contact_id IS NULL OR NOT (
    EXISTS (SELECT 1 FROM public.client_agent_relationships r WHERE r.agent_id=_agent_id AND r.crm_client_id=contact_id
      AND r.client_id=caller AND r.status='active' AND r.ended_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.share_tokens st WHERE st.agent_id=_agent_id AND st.revoked_at IS NULL
      AND (st.expires_at IS NULL OR st.expires_at>now()) AND st.payload->>'type'='client_hotsheet_invite'
      AND public.resolve_share_token(st.token) IS NOT NULL
      AND (st.accepted_by_user_id IS NULL OR st.accepted_by_user_id=caller)
      AND st.payload->>'client_id'=contact_id::text)) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  RETURN aac_privacy.activate_agent_relationship(_agent_id,contact_id);
END $$;
REVOKE ALL ON FUNCTION public.activate_agent_relationship(uuid),public.activate_agent_relationship(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.activate_agent_relationship(uuid),public.activate_agent_relationship(uuid,uuid) TO authenticated,service_role;

-- Persistence follows endpoint authorization; browser requests cannot bypass it.
REVOKE INSERT ON public.agent_messages,public.showing_requests FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS privacy_inquiry_insert ON public.agent_messages;
CREATE POLICY privacy_inquiry_insert ON public.agent_messages AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK (false);
DROP POLICY IF EXISTS privacy_showing_insert ON public.showing_requests;
CREATE POLICY privacy_showing_insert ON public.showing_requests AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK (false);

-- Each permission change has a distinct authorization generation, including
-- opt-out and opt-in within the same transaction.
CREATE OR REPLACE FUNCTION aac_privacy.guard_external_sharing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.external_sharing_allowed AND NEW.external_sharing_authorization IS NULL
      AND NEW.external_sharing_authorized_by IS NULL AND NEW.external_sharing_authorized_at IS NULL THEN RETURN NEW; END IF;
  ELSIF (NEW.external_sharing_allowed, NEW.external_sharing_authorization,
    NEW.external_sharing_authorized_by, NEW.external_sharing_authorized_at)
    IS NOT DISTINCT FROM (OLD.external_sharing_allowed, OLD.external_sharing_authorization,
    OLD.external_sharing_authorized_by, OLD.external_sharing_authorized_at) THEN RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> NEW.agent_id OR NOT public.is_verified_agent()
    OR (TG_OP = 'UPDATE' AND NEW.agent_id <> OLD.agent_id) THEN
    RAISE EXCEPTION 'Only the verified listing agent can authorize external sharing' USING ERRCODE = '42501';
  END IF;
  IF NEW.external_sharing_allowed AND length(btrim(coalesce(NEW.external_sharing_authorization, ''))) < 10 THEN
    RAISE EXCEPTION 'Record the seller authorization and marketing restrictions first';
  END IF;
  NEW.external_sharing_authorized_by := auth.uid();
  NEW.external_sharing_authorized_at := CASE WHEN TG_OP='UPDATE'
    THEN greatest(clock_timestamp(), OLD.external_sharing_authorized_at + interval '1 microsecond')
    ELSE clock_timestamp() END;
  IF TG_OP = 'UPDATE' AND OLD.external_sharing_allowed AND NOT NEW.external_sharing_allowed THEN
    UPDATE public.listing_share_links SET revoked_at = coalesce(revoked_at, now()) WHERE listing_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

-- Service-only: authoritative identity, favorite and current listing scope.
CREATE OR REPLACE FUNCTION public.get_price_alert_context(p_user_id uuid, p_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE recipient_email text; network boolean; sheet_id uuid; item jsonb; authorized_at timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RETURN NULL; END IF;
  SELECT lower(btrim(u.email)) INTO recipient_email FROM auth.users u
    WHERE u.id=p_user_id AND u.email_confirmed_at IS NOT NULL;
  IF recipient_email IS NULL OR NOT EXISTS (SELECT 1 FROM public.favorites f WHERE f.user_id=p_user_id AND f.listing_id=p_listing_id) THEN RETURN NULL; END IF;
  network := public.has_role(p_user_id,'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.agent_settings s WHERE s.user_id=p_user_id AND s.agent_status='verified')
    OR ((EXISTS (SELECT 1 FROM public.feature_flags f WHERE f.flag_name='agent_account_delegates' AND f.enabled)
      OR EXISTS (SELECT 1 FROM public.feature_flag_users f WHERE f.flag_name='agent_account_delegates' AND f.user_id=p_user_id))
      AND EXISTS (SELECT 1 FROM public.agent_account_members m JOIN public.agent_settings s ON s.user_id=m.owner_user_id
        WHERE m.delegate_user_id=p_user_id AND m.status='accepted' AND s.agent_status='verified'));
  IF network THEN
    SELECT to_jsonb(safe) INTO item FROM public.get_public_listing(p_listing_id) safe;
    IF item IS NULL THEN RETURN NULL; END IF;
    RETURN jsonb_build_object('email',recipient_email,'listing',item,'scope',jsonb_build_object('listing_id',p_listing_id,'network',true));
  END IF;
  IF NOT aac_privacy.external_allowed(p_listing_id) THEN RETURN NULL; END IF;
  SELECT h.id INTO sheet_id FROM public.hot_sheets h JOIN public.agent_settings s ON s.user_id=h.user_id
    WHERE h.is_active AND NOT coalesce(h.is_draft,false) AND s.agent_status='verified'
      AND aac_privacy.is_hot_sheet_recipient(p_user_id,h.id)
      AND EXISTS (SELECT 1 FROM aac_privacy.hot_sheet_criteria_matches(h.id,p_listing_id))
    ORDER BY h.created_at DESC,h.id LIMIT 1;
  IF sheet_id IS NULL THEN RETURN NULL; END IF;
  SELECT external_sharing_authorized_at INTO authorized_at FROM public.listings WHERE id=p_listing_id;
  RETURN jsonb_build_object('email',recipient_email,'listing',aac_privacy.safe_listing(p_listing_id),
    'scope',jsonb_build_object('listing_id',p_listing_id,'network',false,'hot_sheet_id',sheet_id,'authorized_at',authorized_at));
END $$;
REVOKE ALL ON FUNCTION public.get_price_alert_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_price_alert_context(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.privacy_email_delivery_allowed(p_policy jsonb, p_to text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE ids uuid[]; sheet uuid; target uuid; item jsonb; agent uuid; context jsonb; recipient uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_policy->>'version' IS DISTINCT FROM '1'
    OR jsonb_typeof(p_policy->'listing_ids') IS DISTINCT FROM 'array'
    OR coalesce(cardinality(p_to),0) < 1 THEN RETURN false; END IF;
  SELECT array_agg(value::uuid) INTO ids FROM jsonb_array_elements_text(p_policy->'listing_ids');
  IF coalesce(cardinality(ids),0) NOT BETWEEN 1 AND 200 THEN RETURN false; END IF;
  IF p_policy->>'audience' = 'favorite' THEN
    IF cardinality(p_to) <> 1 OR jsonb_typeof(p_policy->'scopes') IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_policy->'scopes') <> cardinality(ids) THEN RETURN false; END IF;
    recipient := nullif(p_policy->>'recipient_user_id','')::uuid;
    IF recipient IS NULL THEN RETURN false; END IF;
    FOREACH target IN ARRAY ids LOOP
      context := public.get_price_alert_context(recipient, target);
      IF context IS NULL OR lower(btrim(context->>'email')) IS DISTINCT FROM lower(btrim(p_to[1]))
        OR NOT (p_policy->'scopes' @> jsonb_build_array(context->'scope')) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;
  sheet := nullif(p_policy->>'hot_sheet_id','')::uuid;
  IF p_policy->>'audience' = 'agent' THEN
    IF sheet IS NOT NULL THEN
      SELECT h.user_id INTO agent FROM public.hot_sheets h WHERE h.id = sheet AND h.is_active;
    ELSE
      -- Internal message cards have no Hot Sheet context. The recipient must
      -- still be an actual currently verified agent, never a payload role flag.
      SELECT p.id INTO agent FROM public.agent_profiles p JOIN public.agent_settings s ON s.user_id=p.id
        WHERE lower(btrim(p.email))=lower(btrim(p_to[1])) AND s.agent_status='verified' LIMIT 1;
    END IF;
    RETURN agent IS NOT NULL AND EXISTS (SELECT 1 FROM public.agent_settings s
      WHERE s.user_id = agent AND s.agent_status = 'verified')
      AND NOT EXISTS (SELECT 1 FROM unnest(p_to) address WHERE NOT EXISTS (
        SELECT 1 FROM public.agent_profiles p WHERE p.id = agent AND lower(btrim(p.email)) = lower(btrim(address))))
      AND NOT EXISTS (SELECT 1 FROM unnest(ids) id WHERE NOT EXISTS (SELECT 1 FROM public.listings l WHERE l.id = id));
  END IF;
  IF p_policy->>'audience' IS DISTINCT FROM 'external' THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ids) id WHERE NOT aac_privacy.external_allowed(id)) THEN RETURN false; END IF;
  IF sheet IS NOT NULL THEN
    RETURN NOT EXISTS (SELECT 1 FROM unnest(ids) id WHERE id NOT IN (
      SELECT public.privacy_external_listing_ids(ids, sheet)));
  END IF;
  IF jsonb_typeof(p_policy->'share_tokens') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_policy->'share_tokens') <> cardinality(ids) THEN RETURN false; END IF;
  FOREACH target IN ARRAY ids LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_policy->'share_tokens') token
      WHERE (public.get_shared_listing(token->>'token')->'listing'->>'id')::uuid = target) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.privacy_email_delivery_allowed(jsonb,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_email_delivery_allowed(jsonb,text[]) TO service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA aac_privacy FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
