
-- 1. Extend admin_delete_early_access to also purge by normalized email
--    (scoped strictly to agent_early_access — no cascade to auth/profiles/settings).
CREATE OR REPLACE FUNCTION public.admin_delete_early_access(p_id uuid, p_email text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_email_norm text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.agent_early_access WHERE id = p_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF p_email IS NOT NULL THEN
    v_email_norm := lower(btrim(p_email));
    IF v_email_norm <> '' THEN
      -- Scoped ONLY to agent_early_access. Does not touch auth/profiles/settings.
      DELETE FROM public.agent_early_access WHERE lower(email) = v_email_norm;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;
  END IF;

  RETURN v_count;
END;
$function$;

-- 2. admin_delete_agent: at the very end, also clear any lingering
--    agent_early_access row that shares the same normalized email.
--    We keep the existing body and only append the EA cleanup + return.
CREATE OR REPLACE FUNCTION public.admin_delete_agent(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email   text;
  v_auth_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT lower(email) INTO v_email FROM public.agent_profiles WHERE id = p_agent_id;

  SELECT id INTO v_auth_id FROM auth.users WHERE id = p_agent_id;
  IF v_auth_id IS NULL AND v_email IS NOT NULL THEN
    SELECT id INTO v_auth_id
    FROM auth.users
    WHERE lower(email) = v_email
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  IF v_email IS NULL AND v_auth_id IS NOT NULL THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_auth_id;
  END IF;

  IF v_auth_id IS NOT NULL OR v_email IS NOT NULL THEN
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM public.auth_user_deletion_queue q
        WHERE q.status = 'pending'
          AND (
            (v_auth_id IS NOT NULL AND q.auth_user_id = v_auth_id)
            OR (v_auth_id IS NULL AND lower(q.email) = v_email)
          )
      ) THEN
        INSERT INTO public.auth_user_deletion_queue
          (auth_user_id, email, requested_by, source)
        VALUES (v_auth_id, v_email, auth.uid(), 'admin_delete_agent');
      END IF;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;

  UPDATE public.agent_invites SET accepted_user_id = NULL WHERE accepted_user_id = p_agent_id;
  UPDATE public.listing_status_history SET changed_by = NULL WHERE changed_by = p_agent_id;
  UPDATE public.buyer_credentials SET verified_by = NULL WHERE verified_by = p_agent_id;
  UPDATE public.share_tokens SET accepted_by_user_id = NULL WHERE accepted_by_user_id = p_agent_id;

  DELETE FROM public.hot_sheet_comments WHERE sender_id = p_agent_id;
  DELETE FROM public.seller_matches WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_match_deliveries WHERE agent_id = p_agent_id;
  DELETE FROM public.conversation_participants WHERE user_id = p_agent_id;
  DELETE FROM public.conversation_messages WHERE sender_agent_id = p_agent_id OR recipient_agent_id = p_agent_id;
  DELETE FROM public.share_tokens WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_notifications WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_messages WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_proposal_incentives WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_license_uploads WHERE user_id = p_agent_id;
  DELETE FROM public.email_campaigns WHERE agent_id = p_agent_id;
  DELETE FROM public.client_agent_relationships WHERE agent_id = p_agent_id;

  DELETE FROM public.hot_sheet_clients WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_favorites WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_sent_listings WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_notifications WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_listing_status WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_comments WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheets WHERE user_id = p_agent_id;

  DELETE FROM public.favorite_price_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.favorites WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_status_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_views WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_stats WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.showing_requests WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.agent_messages WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.conversations WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listings WHERE agent_id = p_agent_id;

  DELETE FROM public.listing_drafts WHERE user_id = p_agent_id;
  DELETE FROM public.clients WHERE agent_id = p_agent_id;
  DELETE FROM public.email_templates WHERE agent_id = p_agent_id;
  DELETE FROM public.testimonials WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_buyer_coverage_areas WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_county_preferences WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_state_preferences WHERE agent_id = p_agent_id;
  DELETE FROM public.notification_preferences WHERE user_id = p_agent_id;
  DELETE FROM public.agent_settings WHERE user_id = p_agent_id;
  DELETE FROM public.user_roles WHERE user_id = p_agent_id;
  DELETE FROM public.favorites WHERE user_id = p_agent_id;
  DELETE FROM public.client_needs WHERE submitted_by = p_agent_id;

  DELETE FROM public.profiles WHERE id = p_agent_id;
  DELETE FROM public.agent_profiles WHERE id = p_agent_id;

  -- NEW: also purge any lingering early-access record for this email so
  -- the admin list cannot resurrect the agent as a "ghost" row. Scoped
  -- ONLY to agent_early_access — deterministic normalization, no cascade.
  IF v_email IS NOT NULL AND v_email <> '' THEN
    DELETE FROM public.agent_early_access WHERE lower(email) = v_email;
  END IF;

  IF v_auth_id IS NOT NULL AND v_auth_id <> p_agent_id THEN
    -- legacy path retained
    NULL;
  END IF;

  RETURN jsonb_build_object(
    'auth_user_id', v_auth_id,
    'email', v_email
  );
END;
$function$;

-- 3. Clean up the four confirmed stale early-access rows. Their auth users
--    and profiles were already deleted (auth_user_deletion_queue completed).
DELETE FROM public.agent_early_access
WHERE id IN (
  '15815d70-9a98-4202-a8bc-844c8bf99e91', -- Jeff Simonian
  '47ccf881-781d-4336-ae52-3869fcc71ff0', -- Nick Warren
  'fd181c0a-f1aa-499d-81b2-77210a598613', -- Brandon Foley
  '86f4949b-781a-4146-aa91-3ac8319092be'  -- Michael Gillespie
);
