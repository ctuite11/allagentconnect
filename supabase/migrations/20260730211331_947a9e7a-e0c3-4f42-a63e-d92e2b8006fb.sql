DO $$
DECLARE
  v_ids uuid[] := ARRAY[
    '4a03694a-2815-47e6-9016-dcbef519c589','0999e167-7fe3-4932-8ee0-9ce114b8a07a',
    '50c23819-8266-4907-a690-fabc06027cf8','371618ce-129a-4847-b8c7-e7af69ff8cb4',
    '79caccc7-e163-4b1d-89bf-22ceeb433e71','0f79522d-311a-4ba3-aca8-8f0b378ba24a',
    'dd03915e-26db-43d9-9d2e-c4ca900848a2','aab9cfcf-b2b2-4d4e-a67f-0d4264ffc86b',
    'ef366028-b34b-405c-803d-62d91062ae9e','48fa79ee-709b-4154-b509-70c2a488697f'
  ]::uuid[];
  v_id uuid;
  v_email text;
BEGIN
  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_id;
    IF v_email IS NULL THEN CONTINUE; END IF;

    -- hard safety: never touch the legitimate accounts
    IF v_email IN ('chris@allagentconnect.com','boo@allagentconnect.com') THEN
      RAISE EXCEPTION 'refusing to delete protected account %', v_email;
    END IF;

    -- nullable references
    UPDATE public.agent_invites SET accepted_user_id = NULL WHERE accepted_user_id = v_id;
    UPDATE public.listing_status_history SET changed_by = NULL WHERE changed_by = v_id;
    UPDATE public.buyer_credentials SET verified_by = NULL WHERE verified_by = v_id;
    UPDATE public.share_tokens SET accepted_by_user_id = NULL WHERE accepted_by_user_id = v_id;

    -- listing-owned data
    DELETE FROM public.favorite_price_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = v_id);
    DELETE FROM public.favorites WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = v_id);
    DELETE FROM public.listing_status_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = v_id);
    DELETE FROM public.listing_views WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = v_id);
    DELETE FROM public.listing_stats WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = v_id);
    DELETE FROM public.showing_requests WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = v_id);
    DELETE FROM public.agent_messages WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = v_id);
    DELETE FROM public.conversations WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = v_id);
    DELETE FROM public.listings WHERE agent_id = v_id;
    DELETE FROM public.listing_drafts WHERE user_id = v_id;

    -- hot sheets
    DELETE FROM public.hot_sheet_clients WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = v_id);
    DELETE FROM public.hot_sheet_favorites WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = v_id);
    DELETE FROM public.hot_sheet_sent_listings WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = v_id);
    DELETE FROM public.hot_sheet_notifications WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = v_id);
    DELETE FROM public.hot_sheet_listing_status WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = v_id);
    DELETE FROM public.hot_sheet_comments WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = v_id);
    DELETE FROM public.hot_sheets WHERE user_id = v_id;
    DELETE FROM public.hot_sheet_comments WHERE sender_id = v_id;
    DELETE FROM public.hot_sheet_shares WHERE shared_by_user_id = v_id;

    -- messaging / relationships / crm
    DELETE FROM public.conversation_messages WHERE sender_agent_id = v_id OR recipient_agent_id = v_id;
    DELETE FROM public.conversation_participants WHERE user_id = v_id;
    DELETE FROM public.client_agent_messages WHERE agent_id = v_id OR sender_user_id = v_id;
    DELETE FROM public.client_agent_relationships WHERE agent_id = v_id;
    DELETE FROM public.clients WHERE agent_id = v_id OR agent_user_id = v_id;
    DELETE FROM public.seller_matches WHERE agent_id = v_id;
    DELETE FROM public.agent_match_deliveries WHERE agent_id = v_id;
    DELETE FROM public.agent_match_submissions WHERE user_id = v_id;

    -- workspaces / teams / delegates
    DELETE FROM public.buyer_workspace_invites WHERE agent_id = v_id OR created_by_user_id = v_id OR buyer_user_id = v_id OR accepted_by_user_id = v_id;
    DELETE FROM public.buyer_workspace_members WHERE user_id = v_id;
    DELETE FROM public.buyer_workspaces WHERE owner_id = v_id;
    DELETE FROM public.team_members WHERE agent_id = v_id OR invited_by = v_id;
    DELETE FROM public.teams WHERE created_by = v_id OR team_lead_user_id = v_id;
    DELETE FROM public.agent_account_members WHERE owner_user_id = v_id OR delegate_user_id = v_id;
    DELETE FROM public.agent_active_context WHERE user_id = v_id OR active_owner_user_id = v_id;
    DELETE FROM public.agent_invites WHERE inviter_user_id = v_id;

    -- agent surface + preferences
    DELETE FROM public.agent_buyer_coverage_areas WHERE agent_id = v_id;
    DELETE FROM public.agent_county_preferences WHERE agent_id = v_id;
    DELETE FROM public.agent_state_preferences WHERE agent_id = v_id;
    DELETE FROM public.agent_notifications WHERE agent_id = v_id;
    DELETE FROM public.agent_messages WHERE agent_id = v_id;
    DELETE FROM public.agent_proposal_incentives WHERE agent_id = v_id;
    DELETE FROM public.agent_license_uploads WHERE user_id = v_id;
    DELETE FROM public.agent_sent_broadcasts WHERE agent_id = v_id;
    DELETE FROM public.agent_sent_client_needs WHERE agent_id = v_id;
    DELETE FROM public.agent_sent_listings WHERE agent_id = v_id;
    DELETE FROM public.agent_missing_opportunity_reminders WHERE agent_id = v_id;
    DELETE FROM public.agent_early_access WHERE lower(email) = v_email;
    DELETE FROM public.comms_digest_items WHERE agent_id = v_id;
    DELETE FROM public.comms_digest_sends WHERE agent_id = v_id;
    DELETE FROM public.email_campaigns WHERE agent_id = v_id;
    DELETE FROM public.email_templates WHERE agent_id = v_id;
    DELETE FROM public.testimonials WHERE agent_id = v_id;
    DELETE FROM public.vendor_profiles WHERE user_id = v_id;
    DELETE FROM public.share_tokens WHERE agent_id = v_id;
    DELETE FROM public.saved_searches WHERE created_by = v_id;
    DELETE FROM public.favorites WHERE user_id = v_id;
    DELETE FROM public.buyer_qualifications WHERE user_id = v_id;
    DELETE FROM public.buyer_credentials WHERE user_id = v_id;
    DELETE FROM public.notification_preferences WHERE user_id = v_id;
    DELETE FROM public.feature_flag_users WHERE user_id = v_id OR created_by = v_id;
    DELETE FROM public.pending_verifications WHERE user_id = v_id OR converted_user_id = v_id OR lower(email) = v_email;
    DELETE FROM public.agent_verification_audit WHERE agent_user_id = v_id OR admin_user_id = v_id;
    DELETE FROM public.agent_settings WHERE user_id = v_id;
    DELETE FROM public.agent_profiles WHERE id = v_id;
    DELETE FROM public.user_roles WHERE user_id = v_id;
    DELETE FROM public.profiles WHERE id = v_id;

    -- durable auth deletion (also terminates sessions/refresh tokens on delete)
    IF NOT EXISTS (
      SELECT 1 FROM public.auth_user_deletion_queue q
      WHERE q.status = 'pending' AND q.auth_user_id = v_id
    ) THEN
      INSERT INTO public.auth_user_deletion_queue (auth_user_id, email, requested_by, source)
      VALUES (v_id, v_email, NULL, 'security_incident_2026_07_30_seed_backdoor');
    END IF;
  END LOOP;
END $$;