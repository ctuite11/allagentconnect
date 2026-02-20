
-- ============================================================
-- admin_delete_agent: Full transactional cleanup for an agent
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_agent(p_agent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Enforce admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- SET NULL on blocker FK columns
  UPDATE public.agent_invites SET accepted_user_id = NULL WHERE accepted_user_id = p_agent_id;
  UPDATE public.listing_status_history SET changed_by = NULL WHERE changed_by = p_agent_id;

  -- Explicit deletes for tables with no CASCADE or no FK at all
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

  -- Hot sheet cascade: remove child rows then hot sheets
  DELETE FROM public.hot_sheet_clients WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_favorites WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_sent_listings WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_notifications WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_listing_status WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_comments WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheets WHERE user_id = p_agent_id;

  -- Listing cascade: remove child rows then listings
  DELETE FROM public.favorite_price_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.favorites WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_status_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_views WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_stats WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.showing_requests WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.agent_messages WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.conversations WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listings WHERE agent_id = p_agent_id;

  -- Remaining agent-specific tables
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

  -- Profile tables last
  DELETE FROM public.profiles WHERE id = p_agent_id;
  DELETE FROM public.agent_profiles WHERE id = p_agent_id;
END;
$$;


-- ============================================================
-- admin_delete_consumer: Full transactional cleanup for a buyer
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_consumer(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_client_ids uuid[];
BEGIN
  -- Enforce admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Resolve email for CRM lookups
  SELECT email INTO v_email FROM public.profiles WHERE id = p_user_id;

  -- SET NULL on blocker FK columns
  UPDATE public.share_tokens SET accepted_by_user_id = NULL WHERE accepted_by_user_id = p_user_id;
  UPDATE public.listing_status_history SET changed_by = NULL WHERE changed_by = p_user_id;

  -- Collect CRM client_ids by email
  IF v_email IS NOT NULL THEN
    SELECT array_agg(id) INTO v_client_ids
    FROM public.clients
    WHERE lower(email) = lower(v_email);
  END IF;

  -- CRM cleanup
  IF v_client_ids IS NOT NULL AND array_length(v_client_ids, 1) > 0 THEN
    DELETE FROM public.hot_sheet_clients WHERE client_id = ANY(v_client_ids);
    DELETE FROM public.client_agent_relationships WHERE client_id = ANY(v_client_ids);
    DELETE FROM public.clients WHERE id = ANY(v_client_ids);
  END IF;

  -- Explicit deletes for consumer-specific tables
  DELETE FROM public.hot_sheet_comments WHERE sender_id = p_user_id;
  DELETE FROM public.conversation_participants WHERE user_id = p_user_id;
  DELETE FROM public.favorites WHERE user_id = p_user_id;
  DELETE FROM public.buyer_credentials WHERE user_id = p_user_id;
  DELETE FROM public.buyer_qualifications WHERE user_id = p_user_id;
  DELETE FROM public.notification_preferences WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$$;
