-- =============================================================================
-- Agent Account Delegates — Phase 2 (RLS sweep)
-- Feature flag remains OFF. Safe to deploy: matches_current_account() degrades
-- to auth.uid() checks while agent_account_delegates is disabled.
-- =============================================================================

DROP POLICY IF EXISTS "Agents can create campaigns" ON public.email_campaigns;
CREATE POLICY "Agents can create campaigns"
ON public.email_campaigns
FOR INSERT
WITH CHECK (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can create their own tokens" ON public.share_tokens;
CREATE POLICY "Agents can create their own tokens"
ON public.share_tokens
FOR INSERT
TO authenticated
WITH CHECK (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can delete their own clients" ON public.clients;
CREATE POLICY "Agents can delete their own clients"
ON public.clients
FOR DELETE
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can delete their own county preferences" ON public.agent_county_preferences;
CREATE POLICY "Agents can delete their own county preferences"
ON public.agent_county_preferences
FOR DELETE
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can delete their own coverage areas" ON public.agent_buyer_coverage_areas;
CREATE POLICY "Agents can delete their own coverage areas"
ON public.agent_buyer_coverage_areas
FOR DELETE
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can delete their own listings" ON public.listings;
CREATE POLICY "Agents can delete their own listings"
ON public.listings
FOR DELETE
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can delete their own state preferences" ON public.agent_state_preferences;
CREATE POLICY "Agents can delete their own state preferences"
ON public.agent_state_preferences
FOR DELETE
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can delete their own testimonials" ON public.testimonials;
CREATE POLICY "Agents can delete their own testimonials"
ON public.testimonials
FOR DELETE
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can insert own incentives" ON public.agent_proposal_incentives;
CREATE POLICY "Agents can insert own incentives"
ON public.agent_proposal_incentives
FOR INSERT
WITH CHECK (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can insert their own clients" ON public.clients;
CREATE POLICY "Agents can insert their own clients"
ON public.clients
FOR INSERT
WITH CHECK (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can insert their own county preferences" ON public.agent_county_preferences;
CREATE POLICY "Agents can insert their own county preferences"
ON public.agent_county_preferences
FOR INSERT
WITH CHECK (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can insert their own coverage areas" ON public.agent_buyer_coverage_areas;
CREATE POLICY "Agents can insert their own coverage areas"
ON public.agent_buyer_coverage_areas
FOR INSERT
WITH CHECK (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can insert their own state preferences" ON public.agent_state_preferences;
CREATE POLICY "Agents can insert their own state preferences"
ON public.agent_state_preferences
FOR INSERT
WITH CHECK (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can insert their own testimonials" ON public.testimonials;
CREATE POLICY "Agents can insert their own testimonials"
ON public.testimonials
FOR INSERT
WITH CHECK (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can read own incentives" ON public.agent_proposal_incentives;
CREATE POLICY "Agents can read own incentives"
ON public.agent_proposal_incentives
FOR SELECT
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can update own notifications" ON public.agent_notifications;
CREATE POLICY "Agents can update own notifications"
ON public.agent_notifications
FOR UPDATE
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can update their own clients" ON public.clients;
CREATE POLICY "Agents can update their own clients"
ON public.clients
FOR UPDATE
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can update their own testimonials" ON public.testimonials;
CREATE POLICY "Agents can update their own testimonials"
ON public.testimonials
FOR UPDATE
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can view messages sent to them" ON public.client_agent_messages;
CREATE POLICY "Agents can view messages sent to them"
ON public.client_agent_messages
FOR SELECT
TO authenticated
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can view own notifications" ON public.agent_notifications;
CREATE POLICY "Agents can view own notifications"
ON public.agent_notifications
FOR SELECT
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can view their deliveries" ON public.agent_match_deliveries;
CREATE POLICY "Agents can view their deliveries"
ON public.agent_match_deliveries
FOR SELECT
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can view their own campaigns" ON public.email_campaigns;
CREATE POLICY "Agents can view their own campaigns"
ON public.email_campaigns
FOR SELECT
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can view their own clients" ON public.clients;
CREATE POLICY "Agents can view their own clients"
ON public.clients
FOR SELECT
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can view their own coverage areas" ON public.agent_buyer_coverage_areas;
CREATE POLICY "Agents can view their own coverage areas"
ON public.agent_buyer_coverage_areas
FOR SELECT
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can view their own messages" ON public.agent_messages;
CREATE POLICY "Agents can view their own messages"
ON public.agent_messages
FOR SELECT
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can view their own state preferences" ON public.agent_state_preferences;
CREATE POLICY "Agents can view their own state preferences"
ON public.agent_state_preferences
FOR SELECT
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can view their own testimonials" ON public.testimonials;
CREATE POLICY "Agents can view their own testimonials"
ON public.testimonials
FOR SELECT
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can delete their own draft listings" ON public.listings;
CREATE POLICY "Agents can delete their own draft listings"
ON public.listings
FOR DELETE
USING ((public.matches_current_account(agent_id) AND status = 'draft'))
;

DROP POLICY IF EXISTS "Agents can delete their own templates" ON public.email_templates;
CREATE POLICY "Agents can delete their own templates"
ON public.email_templates
FOR DELETE
USING ((public.matches_current_account(agent_id) AND is_default = false))
;

DROP POLICY IF EXISTS "Agents can insert their own templates" ON public.email_templates;
CREATE POLICY "Agents can insert their own templates"
ON public.email_templates
FOR INSERT
WITH CHECK ((public.matches_current_account(agent_id) AND is_default = false))
;

DROP POLICY IF EXISTS "Agents can update their own templates" ON public.email_templates;
CREATE POLICY "Agents can update their own templates"
ON public.email_templates
FOR UPDATE
USING ((public.matches_current_account(agent_id) AND is_default = false))
;

DROP POLICY IF EXISTS "Agents can view their own templates" ON public.email_templates;
CREATE POLICY "Agents can view their own templates"
ON public.email_templates
FOR SELECT
USING ((public.matches_current_account(agent_id) OR is_default = true))
;

DROP POLICY IF EXISTS "Agents can delete their own tokens" ON public.share_tokens;
CREATE POLICY "Agents can delete their own tokens"
ON public.share_tokens
FOR DELETE
TO authenticated
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can update their own tokens" ON public.share_tokens;
CREATE POLICY "Agents can update their own tokens"
ON public.share_tokens
FOR UPDATE
TO authenticated
USING ((public.matches_current_account(agent_id) AND accepted_by_user_id IS NULL AND accepted_at IS NULL))
;

DROP POLICY IF EXISTS "Agents can view their own tokens" ON public.share_tokens;
CREATE POLICY "Agents can view their own tokens"
ON public.share_tokens
FOR SELECT
TO authenticated
USING (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Agents can update own incentives" ON public.agent_proposal_incentives;
CREATE POLICY "Agents can update own incentives"
ON public.agent_proposal_incentives
FOR UPDATE
USING (public.matches_current_account(agent_id))
WITH CHECK (public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Users can create their own hot sheets" ON public.hot_sheets;
CREATE POLICY "Users can create their own hot sheets"
ON public.hot_sheets
FOR INSERT
WITH CHECK (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can delete their own hot sheets" ON public.hot_sheets;
CREATE POLICY "Users can delete their own hot sheets"
ON public.hot_sheets
FOR DELETE
USING (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can view their own hot sheets" ON public.hot_sheets;
CREATE POLICY "Users can view their own hot sheets"
ON public.hot_sheets
FOR SELECT
USING (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can insert their own drafts" ON public.listing_drafts;
CREATE POLICY "Users can insert their own drafts"
ON public.listing_drafts
FOR INSERT
WITH CHECK (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can delete their own drafts" ON public.listing_drafts;
CREATE POLICY "Users can delete their own drafts"
ON public.listing_drafts
FOR DELETE
USING (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can update their own drafts" ON public.listing_drafts;
CREATE POLICY "Users can update their own drafts"
ON public.listing_drafts
FOR UPDATE
USING (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can view their own drafts" ON public.listing_drafts;
CREATE POLICY "Users can view their own drafts"
ON public.listing_drafts
FOR SELECT
USING (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can create their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can create their own notification preferences"
ON public.notification_preferences
FOR INSERT
WITH CHECK (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own notification preferences"
ON public.notification_preferences
FOR UPDATE
USING (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own notification preferences"
ON public.notification_preferences
FOR SELECT
USING (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can view their own hot sheet notifications" ON public.hot_sheet_notifications;
CREATE POLICY "Users can view their own hot sheet notifications"
ON public.hot_sheet_notifications
FOR SELECT
USING (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can update their own hot sheets" ON public.hot_sheets;
CREATE POLICY "Users can update their own hot sheets"
ON public.hot_sheets
FOR UPDATE
TO authenticated
USING (public.matches_current_account(user_id))
WITH CHECK (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can update own hot sheets" ON public.hot_sheets;
CREATE POLICY "Users can update own hot sheets"
ON public.hot_sheets
FOR UPDATE
TO authenticated
USING (public.matches_current_account(user_id))
WITH CHECK (public.matches_current_account(user_id))
;

DROP POLICY IF EXISTS "Users can read own settings" ON public.agent_settings;
CREATE POLICY "Users can read own settings"
ON public.agent_settings
FOR SELECT
USING (user_id = public.current_account_owner_id())
;

DROP POLICY IF EXISTS "Users can update own settings" ON public.agent_settings;
CREATE POLICY "Users can update own settings"
ON public.agent_settings
FOR UPDATE
USING (user_id = public.current_account_owner_id())
;

DROP POLICY IF EXISTS "Agents can update their own profile" ON public.agent_profiles;
CREATE POLICY "Agents can update their own profile"
ON public.agent_profiles
FOR UPDATE
USING (id = public.current_account_owner_id())
;

DROP POLICY IF EXISTS "Agents can update showing requests for their listings" ON public.showing_requests;
CREATE POLICY "Agents can update showing requests for their listings"
ON public.showing_requests
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.listings
  WHERE listings.id = showing_requests.listing_id
    AND public.matches_current_account(listings.agent_id)
))
;

DROP POLICY IF EXISTS "Agents can view price history for their listings" ON public.listing_price_history;
CREATE POLICY "Agents can view price history for their listings"
ON public.listing_price_history
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.listings
  WHERE listings.id = listing_price_history.listing_id
    AND public.matches_current_account(listings.agent_id)
))
;

DROP POLICY IF EXISTS "Agents can view shares for their listings" ON public.listing_shares;
CREATE POLICY "Agents can view shares for their listings"
ON public.listing_shares
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.listings
  WHERE listings.id = listing_shares.listing_id
    AND public.matches_current_account(listings.agent_id)
))
;

DROP POLICY IF EXISTS "Agents can view showing requests for their listings" ON public.showing_requests;
CREATE POLICY "Agents can view showing requests for their listings"
ON public.showing_requests
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.listings
  WHERE listings.id = showing_requests.listing_id
    AND public.matches_current_account(listings.agent_id)
))
;

DROP POLICY IF EXISTS "Agents can view status history for their listings" ON public.listing_status_history;
CREATE POLICY "Agents can view status history for their listings"
ON public.listing_status_history
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.listings
  WHERE listings.id = listing_status_history.listing_id
    AND public.matches_current_account(listings.agent_id)
))
;

DROP POLICY IF EXISTS "Agents can view their listing views" ON public.listing_views;
CREATE POLICY "Agents can view their listing views"
ON public.listing_views
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.listings
  WHERE listings.id = listing_views.listing_id
    AND public.matches_current_account(listings.agent_id)
))
;

DROP POLICY IF EXISTS "Agents can view views on their listings" ON public.off_market_views;
CREATE POLICY "Agents can view views on their listings"
ON public.off_market_views
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.listings
  WHERE listings.id = off_market_views.listing_id
    AND public.matches_current_account(listings.agent_id)
))
;

DROP POLICY IF EXISTS "Agents can view sent listings for their hot sheets" ON public.hot_sheet_sent_listings;
CREATE POLICY "Agents can view sent listings for their hot sheets"
ON public.hot_sheet_sent_listings
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_sent_listings.hot_sheet_id
    AND public.matches_current_account(hot_sheets.user_id)
))
;

DROP POLICY IF EXISTS "Users can add clients to their hot sheets" ON public.hot_sheet_clients;
CREATE POLICY "Users can add clients to their hot sheets"
ON public.hot_sheet_clients
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_clients.hot_sheet_id
    AND public.matches_current_account(hot_sheets.user_id)
))
;

DROP POLICY IF EXISTS "Users can remove clients from their hot sheets" ON public.hot_sheet_clients;
CREATE POLICY "Users can remove clients from their hot sheets"
ON public.hot_sheet_clients
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_clients.hot_sheet_id
    AND public.matches_current_account(hot_sheets.user_id)
))
;

DROP POLICY IF EXISTS "Users can view clients for their hot sheets" ON public.hot_sheet_clients;
CREATE POLICY "Users can view clients for their hot sheets"
ON public.hot_sheet_clients
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_clients.hot_sheet_id
    AND public.matches_current_account(hot_sheets.user_id)
))
;

DROP POLICY IF EXISTS "Users can create shares for their hot sheets" ON public.hot_sheet_shares;
CREATE POLICY "Users can create shares for their hot sheets"
ON public.hot_sheet_shares
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_shares.hot_sheet_id
    AND public.matches_current_account(hot_sheets.user_id)
))
;

DROP POLICY IF EXISTS "Users can delete shares for their hot sheets" ON public.hot_sheet_shares;
CREATE POLICY "Users can delete shares for their hot sheets"
ON public.hot_sheet_shares
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_shares.hot_sheet_id
    AND public.matches_current_account(hot_sheets.user_id)
))
;

DROP POLICY IF EXISTS "Users can view shares for their hot sheets" ON public.hot_sheet_shares;
CREATE POLICY "Users can view shares for their hot sheets"
ON public.hot_sheet_shares
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_shares.hot_sheet_id
    AND public.matches_current_account(hot_sheets.user_id)
))
;

DROP POLICY IF EXISTS "Users can delete status for their hot sheets" ON public.hot_sheet_listing_status;
CREATE POLICY "Users can delete status for their hot sheets"
ON public.hot_sheet_listing_status
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_listing_status.hot_sheet_id
    AND public.matches_current_account(hot_sheets.user_id)
))
;

DROP POLICY IF EXISTS "Users can insert status for their hot sheets" ON public.hot_sheet_listing_status;
CREATE POLICY "Users can insert status for their hot sheets"
ON public.hot_sheet_listing_status
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_listing_status.hot_sheet_id
    AND public.matches_current_account(hot_sheets.user_id)
))
;

DROP POLICY IF EXISTS "Users can update status for their hot sheets" ON public.hot_sheet_listing_status;
CREATE POLICY "Users can update status for their hot sheets"
ON public.hot_sheet_listing_status
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_listing_status.hot_sheet_id
    AND public.matches_current_account(hot_sheets.user_id)
))
;

DROP POLICY IF EXISTS "Users can view status for their hot sheets" ON public.hot_sheet_listing_status;
CREATE POLICY "Users can view status for their hot sheets"
ON public.hot_sheet_listing_status
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_listing_status.hot_sheet_id
    AND public.matches_current_account(hot_sheets.user_id)
))
;

DROP POLICY IF EXISTS "Agents manage subscribers for their hot sheets" ON public.hot_sheet_subscribers;
CREATE POLICY "Agents manage subscribers for their hot sheets"
ON public.hot_sheet_subscribers
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.hot_sheets hs
  WHERE hs.id = hot_sheet_subscribers.hot_sheet_id
    AND public.matches_current_account(hs.user_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.hot_sheets hs
  WHERE hs.id = hot_sheet_subscribers.hot_sheet_id
    AND public.matches_current_account(hs.user_id)
))
;

DROP POLICY IF EXISTS "Agents and clients can view comments" ON public.hot_sheet_comments;
CREATE POLICY "Agents and clients can view comments"
ON public.hot_sheet_comments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.hot_sheets
  WHERE hot_sheets.id = hot_sheet_comments.hot_sheet_id
    AND (public.matches_current_account(hot_sheets.user_id) OR true)
))
;

DROP POLICY IF EXISTS "Agents can view clicks from their campaigns" ON public.email_clicks;
CREATE POLICY "Agents can view clicks from their campaigns"
ON public.email_clicks
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM public.email_sends es
  JOIN public.email_campaigns ec ON ec.id = es.campaign_id
  WHERE es.id = email_clicks.email_send_id
    AND public.matches_current_account(ec.agent_id)
))
;

DROP POLICY IF EXISTS "Agents can view opens from their campaigns" ON public.email_opens;
CREATE POLICY "Agents can view opens from their campaigns"
ON public.email_opens
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM public.email_sends es
  JOIN public.email_campaigns ec ON ec.id = es.campaign_id
  WHERE es.id = email_opens.email_send_id
    AND public.matches_current_account(ec.agent_id)
))
;

DROP POLICY IF EXISTS "Agents can view sends from their campaigns" ON public.email_sends;
CREATE POLICY "Agents can view sends from their campaigns"
ON public.email_sends
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.email_campaigns
  WHERE email_campaigns.id = email_sends.campaign_id
    AND public.matches_current_account(email_campaigns.agent_id)
))
;

DROP POLICY IF EXISTS "Agents can read their own invite events" ON public.invite_events;
CREATE POLICY "Agents can read their own invite events"
ON public.invite_events
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.share_tokens st
  WHERE st.id = invite_events.token_id
    AND public.matches_current_account(st.agent_id)
))
;

DROP POLICY IF EXISTS "Anyone can view published listings" ON public.listings;
CREATE POLICY "Anyone can view published listings"
ON public.listings
FOR SELECT
USING ((status = ANY (ARRAY[
  'active','new','coming_soon','off_market','back_on_market','price_changed',
  'extended','reactivated','under_agreement','pending','contingent','sold','rented'
])) OR public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Verified agents can create listings" ON public.listings;
CREATE POLICY "Verified agents can create listings"
ON public.listings
FOR INSERT
TO authenticated
WITH CHECK (public.is_verified_agent() AND public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Verified agents can update their listings" ON public.listings;
CREATE POLICY "Verified agents can update their listings"
ON public.listings
FOR UPDATE
TO authenticated
USING (public.matches_current_account(agent_id))
WITH CHECK (public.is_verified_agent() AND public.matches_current_account(agent_id))
;

DROP POLICY IF EXISTS "Verified agents can insert buyer needs" ON public.client_needs;
CREATE POLICY "Verified agents can insert buyer needs"
ON public.client_needs
FOR INSERT
TO authenticated
WITH CHECK (public.is_verified_agent() AND public.matches_current_account(submitted_by))
;

DROP POLICY IF EXISTS "Verified agents can view matched submissions" ON public.agent_match_submissions;
CREATE POLICY "Verified agents can view matched submissions"
ON public.agent_match_submissions
FOR SELECT
USING ((auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.agent_match_deliveries d
  WHERE d.submission_id = agent_match_submissions.id
    AND public.matches_current_account(d.agent_id)
)))
;

DROP POLICY IF EXISTS "Agents can view their agent relationships" ON public.client_agent_relationships;
CREATE POLICY "Agents can view their agent relationships"
ON public.client_agent_relationships
FOR SELECT
TO authenticated
USING (public.matches_current_account(client_agent_relationships.agent_id))
;

DROP POLICY IF EXISTS "Agents can view their conversations" ON public.conversations;
CREATE POLICY "Agents can view their conversations"
ON public.conversations
FOR SELECT
USING ((public.matches_current_account(agent_a_id) OR public.matches_current_account(agent_b_id)))
;

DROP POLICY IF EXISTS "Agents can update their conversations" ON public.conversations;
CREATE POLICY "Agents can update their conversations"
ON public.conversations
FOR UPDATE
USING ((public.matches_current_account(agent_a_id) OR public.matches_current_account(agent_b_id)))
;

DROP POLICY IF EXISTS "Verified agents can create conversations" ON public.conversations;
CREATE POLICY "Verified agents can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (public.is_verified_agent() AND (public.matches_current_account(agent_a_id) OR public.matches_current_account(agent_b_id)) AND agent_a_id <> agent_b_id)
;

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
ON public.conversations
FOR SELECT
USING ((EXISTS (
  SELECT 1 FROM public.conversation_participants cp
  WHERE cp.conversation_id = conversations.id
    AND cp.user_id = public.current_account_owner_id()
) OR (public.matches_current_account(agent_a_id) OR public.matches_current_account(agent_b_id))))
;

DROP POLICY IF EXISTS "Agents can view messages in their conversations" ON public.conversation_messages;
CREATE POLICY "Agents can view messages in their conversations"
ON public.conversation_messages
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.conversations c
  WHERE c.id = conversation_messages.conversation_id
    AND (public.matches_current_account(c.agent_a_id) OR public.matches_current_account(c.agent_b_id))
))
;

DROP POLICY IF EXISTS "Verified agents can send messages in their conversations" ON public.conversation_messages;
CREATE POLICY "Verified agents can send messages in their conversations"
ON public.conversation_messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_verified_agent()
  AND sender_agent_id = public.effective_agent_id()
  AND public.matches_current_account(sender_agent_id)
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_messages.conversation_id
      AND (
        (c.agent_a_id = conversation_messages.sender_agent_id AND c.agent_b_id = conversation_messages.recipient_agent_id)
        OR (c.agent_b_id = conversation_messages.sender_agent_id AND c.agent_a_id = conversation_messages.recipient_agent_id)
      )
  ))
;

DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.conversation_messages;
CREATE POLICY "Recipients can mark messages as read"
ON public.conversation_messages
FOR UPDATE
TO authenticated
USING (recipient_agent_id = public.effective_agent_id())
WITH CHECK (recipient_agent_id = public.effective_agent_id())
;

DROP POLICY IF EXISTS "messages_select_participant" ON public.conversation_messages;
CREATE POLICY "messages_select_participant"
ON public.conversation_messages
FOR SELECT
USING ((EXISTS (
  SELECT 1 FROM public.conversation_participants cp
  WHERE cp.conversation_id = conversation_messages.conversation_id
    AND cp.user_id = public.current_account_owner_id()
) OR sender_agent_id = public.effective_agent_id() OR recipient_agent_id = public.effective_agent_id()
  OR sender_agent_id = auth.uid() OR recipient_agent_id = auth.uid()))
;

DROP POLICY IF EXISTS "messages_insert_participant" ON public.conversation_messages;
CREATE POLICY "messages_insert_participant"
ON public.conversation_messages
FOR INSERT
WITH CHECK (sender_agent_id = public.effective_agent_id()
  AND (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_messages.conversation_id
        AND cp.user_id = public.current_account_owner_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_messages.conversation_id
        AND (public.matches_current_account(c.agent_a_id) OR public.matches_current_account(c.agent_b_id))
    )
  ))
;

DROP POLICY IF EXISTS "cp_select_own" ON public.conversation_participants;
CREATE POLICY "cp_select_own"
ON public.conversation_participants
FOR SELECT
USING ((user_id = auth.uid() OR user_id = public.current_account_owner_id()))
;

DROP POLICY IF EXISTS "cp_update_own" ON public.conversation_participants;
CREATE POLICY "cp_update_own"
ON public.conversation_participants
FOR UPDATE
USING ((user_id = auth.uid() OR user_id = public.current_account_owner_id()))
WITH CHECK ((user_id = auth.uid() OR user_id = public.current_account_owner_id()))
;

DROP POLICY IF EXISTS "cp_insert_conversation_creator" ON public.conversation_participants;
CREATE POLICY "cp_insert_conversation_creator"
ON public.conversation_participants
FOR INSERT
WITH CHECK ((auth.role() = 'authenticated' AND (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_participants.conversation_id
      AND (public.matches_current_account(c.agent_a_id) OR public.matches_current_account(c.agent_b_id))
  )
)))
;
-- ---------------------------------------------------------------------------
-- Core function updates
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_verified_agent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN NOT public.is_feature_enabled('agent_account_delegates') THEN
        EXISTS (
          SELECT 1
          FROM public.agent_settings s
          WHERE s.user_id = auth.uid()
            AND s.agent_status = 'verified'
        )
      ELSE
        public.is_verified_agent_for_context(public.current_account_owner_id())
    END;
$$;

REVOKE ALL ON FUNCTION public.is_verified_agent() FROM public;
GRANT EXECUTE ON FUNCTION public.is_verified_agent() TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_user_role(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_is_admin  boolean;
  v_is_agent  boolean;
  v_is_buyer  boolean;
  v_verified  boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RETURN jsonb_build_object('role', 'unknown', 'is_verified_agent', false);
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') INTO v_is_admin;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'agent') INTO v_is_agent;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'buyer') INTO v_is_buyer;

  IF v_is_agent THEN
    SELECT EXISTS (
      SELECT 1 FROM public.agent_settings
      WHERE user_id = _user_id AND agent_status = 'verified'
    ) INTO v_verified;
  ELSE
    v_verified := false;
  END IF;

  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'is_verified_agent', COALESCE(v_verified, false),
      'is_licensed_owner', public.is_licensed_owner(),
      'is_delegate', public.is_delegate(),
      'active_owner_user_id', public.current_account_owner_id(),
      'delegate_memberships', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'owner_user_id', m.owner_user_id,
          'display_name', m.display_name,
          'role_label', m.role_label
        ) ORDER BY m.display_name NULLS LAST, m.owner_user_id)
        FROM public.agent_account_members m
        WHERE m.delegate_user_id = _user_id
          AND m.status = 'accepted'
      ), '[]'::jsonb)
    );
  END IF;

  IF v_is_agent THEN
    RETURN jsonb_build_object(
      'role', 'agent',
      'is_verified_agent', COALESCE(v_verified, false),
      'is_licensed_owner', public.is_licensed_owner(),
      'is_delegate', public.is_delegate(),
      'active_owner_user_id', public.current_account_owner_id(),
      'delegate_memberships', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'owner_user_id', m.owner_user_id,
          'display_name', m.display_name,
          'role_label', m.role_label
        ) ORDER BY m.display_name NULLS LAST, m.owner_user_id)
        FROM public.agent_account_members m
        WHERE m.delegate_user_id = _user_id
          AND m.status = 'accepted'
      ), '[]'::jsonb)
    );
  END IF;

  IF v_is_buyer THEN
    RETURN jsonb_build_object('role', 'buyer', 'is_verified_agent', false);
  END IF;

  RETURN jsonb_build_object('role', 'unknown', 'is_verified_agent', false);
END;
$function$;

-- ---------------------------------------------------------------------------
-- conversation_inbox view (delegate sees owner's participant rows)
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.conversation_inbox;

CREATE VIEW public.conversation_inbox AS
SELECT c.id AS conversation_id,
    c.last_message_at,
    cp.last_read_at,
    lm.body AS last_message_preview,
    lm.sender_agent_id AS last_message_sender_id,
    c.last_message_at > COALESCE(cp.last_read_at, '1970-01-01 00:00:00+00'::timestamptz)
      AND lm.sender_agent_id IS DISTINCT FROM cp.user_id AS is_unread,
    COALESCE(uc.cnt, 0) AS unread_count,
    CASE
        WHEN c.agent_a_id = cp.user_id THEN c.agent_b_id
        ELSE c.agent_a_id
    END AS other_user_id,
    c.listing_id,
    c.buyer_need_id
FROM public.conversations c
JOIN public.conversation_participants cp ON cp.conversation_id = c.id
LEFT JOIN LATERAL (
    SELECT m.body, m.sender_agent_id
    FROM public.conversation_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
) lm ON true
LEFT JOIN LATERAL (
    SELECT count(*)::int AS cnt
    FROM public.conversation_messages m2
    WHERE m2.conversation_id = c.id
      AND m2.sender_agent_id IS DISTINCT FROM cp.user_id
      AND m2.created_at > COALESCE(cp.last_read_at, '1970-01-01 00:00:00+00'::timestamptz)
) uc ON true
WHERE cp.user_id = public.current_account_owner_id()
  AND cp.is_archived = false;

-- ---------------------------------------------------------------------------
-- Agent-scoped SECURITY DEFINER functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_buyer_contact_row(p_crm_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent uuid := public.effective_agent_id();
  v_client RECORD;
BEGIN
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, agent_id, first_name, last_name, lower(email) AS email, phone, client_type, created_at
    INTO v_client
  FROM public.clients
  WHERE id = p_crm_client_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', false,
      'crm_client_id', p_crm_client_id,
      'agent_id', v_agent
    );
  END IF;

  IF v_client.agent_id <> v_agent THEN
    RAISE EXCEPTION 'Not authorized for this contact';
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'crm_client_id', p_crm_client_id,
    'agent_id', v_agent,
    'client', jsonb_build_object(
      'id', v_client.id,
      'first_name', v_client.first_name,
      'last_name', v_client.last_name,
      'email', v_client.email,
      'phone', v_client.phone,
      'client_type', v_client.client_type,
      'created_at', v_client.created_at
    ),
    'relationships', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'status', r.status,
          'client_id', r.client_id,
          'crm_client_id', r.crm_client_id,
          'ended_at', r.ended_at,
          'created_at', r.created_at
        )
        ORDER BY r.created_at DESC
      )
      FROM public.client_agent_relationships r
      WHERE r.agent_id = v_agent
        AND (r.crm_client_id = p_crm_client_id OR r.client_id = p_crm_client_id)
    ), '[]'::jsonb),
    'active_relationship_count', (
      SELECT count(*)::integer
      FROM public.client_agent_relationships r
      WHERE r.agent_id = v_agent
        AND r.ended_at IS NULL
        AND r.status IN ('active', 'pending')
        AND (r.crm_client_id = p_crm_client_id OR r.client_id = p_crm_client_id)
    ),
    'hot_sheet_memberships', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'hot_sheet_id', hsc.hot_sheet_id,
          'hot_sheet_title', hs.title
        )
      )
      FROM public.hot_sheet_clients hsc
      JOIN public.hot_sheets hs ON hs.id = hsc.hot_sheet_id
      WHERE hsc.client_id = p_crm_client_id
        AND hs.user_id = v_agent
    ), '[]'::jsonb),
    'owned_hot_sheets', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', hs.id,
          'title', hs.title,
          'created_at', hs.created_at
        )
        ORDER BY hs.created_at DESC
      )
      FROM public.hot_sheets hs
      WHERE hs.user_id = v_agent
        AND hs.client_id = p_crm_client_id
    ), '[]'::jsonb),
    'share_tokens', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', st.id,
          'accepted_at', st.accepted_at,
          'revoked_at', st.revoked_at,
          'created_at', st.created_at
        )
        ORDER BY st.created_at DESC
      )
      FROM public.share_tokens st
      WHERE st.agent_id = v_agent
        AND (st.payload->>'type') = 'client_hotsheet_invite'
        AND (
          (st.payload->>'client_id') = p_crm_client_id::text
          OR (
            v_client.email IS NOT NULL
            AND lower(st.payload->>'client_email') = v_client.email
          )
        )
    ), '[]'::jsonb)
  );
END;
$function$;


REVOKE ALL ON FUNCTION public.verify_buyer_contact_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_buyer_contact_row(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_buyer_contact_row(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.agent_end_client_relationship(p_client_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rows_affected bigint;
  v_hot_sheet_ids uuid[];
  v_client_email text;
  v_buyer_user_ids uuid[];
  v_buyer_uid uuid;
  v_agent uuid := public.effective_agent_id();
  v_owned_contact boolean := false;
  v_audit_action text;
BEGIN
  SELECT lower(email) INTO v_client_email
  FROM public.clients
  WHERE id = p_client_id
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = p_client_id
      AND c.agent_id = v_agent
  ) INTO v_owned_contact;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_hot_sheet_ids
  FROM public.hot_sheets
  WHERE user_id = v_agent
    AND client_id = p_client_id;

  IF array_length(v_hot_sheet_ids, 1) IS NOT NULL THEN
    DELETE FROM public.hot_sheet_sent_listings  WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_comments       WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_listing_status WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_notifications  WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_favorites      WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_clients        WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheets               WHERE id            = ANY(v_hot_sheet_ids);
  END IF;

  DELETE FROM public.hot_sheet_clients hsc
  USING public.hot_sheets hs
  WHERE hsc.hot_sheet_id = hs.id
    AND hs.user_id = v_agent
    AND hsc.client_id = p_client_id;

  UPDATE public.share_tokens
  SET revoked_at = now()
  WHERE agent_id = v_agent
    AND revoked_at IS NULL
    AND (payload->>'type') = 'client_hotsheet_invite'
    AND (
      (payload->>'client_id') = p_client_id::text
      OR (
        v_client_email IS NOT NULL
        AND lower(payload->>'client_email') = v_client_email
      )
    );

  SELECT COALESCE(array_agg(DISTINCT client_id) FILTER (WHERE client_id IS NOT NULL), ARRAY[]::uuid[])
    INTO v_buyer_user_ids
  FROM public.client_agent_relationships
  WHERE agent_id = v_agent
    AND ended_at IS NULL
    AND status IN ('active', 'pending')
    AND (client_id = p_client_id OR crm_client_id = p_client_id);

  UPDATE public.client_agent_relationships
  SET status = 'inactive',
      ended_at = now()
  WHERE agent_id = v_agent
    AND ended_at IS NULL
    AND status IN ('active', 'pending')
    AND (client_id = p_client_id OR crm_client_id = p_client_id);

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    IF NOT v_owned_contact THEN
      RAISE EXCEPTION 'No active or pending relationship found for agent % with identifier %.', v_agent, p_client_id;
    END IF;
    v_audit_action := 'END_BUYER_ORPHAN_CONTACT';
  ELSE
    v_audit_action := 'END_BUYER_RELATIONSHIP';
  END IF;

  UPDATE public.clients
  SET client_type = NULL
  WHERE id = p_client_id
    AND agent_id = v_agent
    AND client_type = 'buyer';

  -- If the contact is CRM-only, deleting the CRM row would otherwise cause the
  -- foreign key to clear crm_client_id on these rows while client_id is already
  -- null, violating client_agent_relationships_identity_present.
  DELETE FROM public.client_agent_relationships
  WHERE agent_id = v_agent
    AND crm_client_id = p_client_id
    AND client_id IS NULL;

  IF array_length(v_buyer_user_ids, 1) IS NOT NULL THEN
    FOREACH v_buyer_uid IN ARRAY v_buyer_user_ids LOOP
      PERFORM public.archive_conversations_between_users(v_agent, v_buyer_uid);
    END LOOP;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, acting_as_user_id)
  VALUES (
    auth.uid(),
    v_audit_action,
    'clients',
    p_client_id,
    CASE WHEN v_agent IS DISTINCT FROM auth.uid() THEN v_agent ELSE NULL END
  );

  RETURN rows_affected;
END;
$function$;
CREATE OR REPLACE FUNCTION public.agent_end_client_relationship_by_id(p_relationship_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agent uuid := public.effective_agent_id();
  v_rel RECORD;
  v_crm_client_id uuid;
  v_client_email text;
  v_hot_sheet_ids uuid[];
  rows_affected bigint;
BEGIN
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, agent_id, client_id, crm_client_id, status, ended_at
    INTO v_rel
  FROM public.client_agent_relationships
  WHERE id = p_relationship_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relationship not found';
  END IF;

  IF v_rel.agent_id <> v_agent THEN
    RAISE EXCEPTION 'Not authorized for this relationship';
  END IF;

  v_crm_client_id := v_rel.crm_client_id;

  IF v_crm_client_id IS NOT NULL THEN
    SELECT lower(email) INTO v_client_email
    FROM public.clients
    WHERE id = v_crm_client_id
    LIMIT 1;
  END IF;

  IF v_client_email IS NULL AND v_rel.client_id IS NOT NULL THEN
    SELECT lower(email) INTO v_client_email
    FROM public.profiles
    WHERE id = v_rel.client_id
    LIMIT 1;
  END IF;

  IF v_crm_client_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO v_hot_sheet_ids
    FROM public.hot_sheets
    WHERE user_id = v_agent
      AND client_id = v_crm_client_id;

    IF array_length(v_hot_sheet_ids, 1) IS NOT NULL THEN
      DELETE FROM public.hot_sheet_sent_listings  WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
      DELETE FROM public.hot_sheet_comments       WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
      DELETE FROM public.hot_sheet_listing_status WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
      DELETE FROM public.hot_sheet_notifications  WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
      DELETE FROM public.hot_sheet_favorites      WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
      DELETE FROM public.hot_sheet_clients        WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
      DELETE FROM public.hot_sheets               WHERE id            = ANY(v_hot_sheet_ids);
    END IF;

    DELETE FROM public.hot_sheet_clients hsc
    USING public.hot_sheets hs
    WHERE hsc.hot_sheet_id = hs.id
      AND hs.user_id = v_agent
      AND hsc.client_id = v_crm_client_id;
  END IF;

  UPDATE public.share_tokens
     SET revoked_at = now()
   WHERE agent_id = v_agent
     AND revoked_at IS NULL
     AND (payload->>'type') = 'client_hotsheet_invite'
     AND (
       (v_crm_client_id IS NOT NULL AND (payload->>'client_id') = v_crm_client_id::text)
       OR (v_client_email IS NOT NULL AND lower(payload->>'client_email') = v_client_email)
     );

  UPDATE public.client_agent_relationships
  SET status = 'inactive',
      ended_at = now()
  WHERE id = p_relationship_id
    AND ended_at IS NULL;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF v_crm_client_id IS NOT NULL THEN
    UPDATE public.clients
    SET client_type = NULL
    WHERE id = v_crm_client_id
      AND agent_id = v_agent
      AND client_type = 'buyer';
  END IF;

  -- Archive 1:1 conversations between this agent and this buyer
  IF v_rel.client_id IS NOT NULL THEN
    PERFORM public.archive_conversations_between_users(v_agent, v_rel.client_id);
  END IF;

  RETURN rows_affected;
END;
$function$;
REVOKE ALL ON FUNCTION public.agent_end_client_relationship_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_end_client_relationship_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_end_client_relationship_by_id(uuid) TO service_role;

-- Fix conversation_participants writes from the app:
-- `upsert(..., onConflict)` performs ON CONFLICT DO UPDATE by default. `cp_update_own` only allows
-- updating rows where user_id = auth.uid(), so the agent cannot upsert-update the buyer's row.
--
-- This RPC runs as SECURITY DEFINER, checks the caller is agent_a or agent_b on the conversation,
-- then inserts both participant rows with ON CONFLICT DO NOTHING (no UPDATE path).

CREATE OR REPLACE FUNCTION public.ensure_conversation_participants_for_caller(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_other uuid;
  v_listing uuid;
  v_linked boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT c.agent_a_id, c.agent_b_id, c.listing_id
  INTO v_a, v_b, v_listing
  FROM public.conversations c
  WHERE c.id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = 'P0002';
  END IF;

  IF public.effective_agent_id() IS DISTINCT FROM v_a AND public.effective_agent_id() IS DISTINCT FROM v_b THEN
    RAISE EXCEPTION 'Not a party on this conversation' USING ERRCODE = '42501';
  END IF;

  v_other := CASE WHEN v_a = public.effective_agent_id() THEN v_b ELSE v_a END;

  -- Listing-scoped thread: property / inbox flows may not have a CRM relationship row
  IF v_listing IS NOT NULL THEN
    v_linked := true;
  END IF;

  -- Workspace / invite link: explicit client id on relationship
  IF EXISTS (
    SELECT 1
    FROM public.client_agent_relationships car
    WHERE car.status IN ('active', 'pending')
      AND (
        (car.agent_id = public.effective_agent_id() AND car.client_id = v_other)
        OR (car.agent_id = v_other AND car.client_id = auth.uid())
      )
  ) THEN
    v_linked := true;
  END IF;

  -- CRM-only row: match buyer auth profile to client email (either caller is agent or counterparty is agent)
  IF NOT v_linked AND EXISTS (
    SELECT 1
    FROM public.client_agent_relationships car
    INNER JOIN public.clients cl ON cl.id = car.crm_client_id
    INNER JOIN public.profiles pf ON lower(btrim(pf.email)) = lower(btrim(cl.email))
    WHERE car.status IN ('active', 'pending')
      AND car.client_id IS NULL
      AND (
        (car.agent_id = public.effective_agent_id() AND pf.id = v_other)
        OR (car.agent_id = v_other AND pf.id = auth.uid())
      )
  ) THEN
    v_linked := true;
  END IF;

  -- Peer AAC agents (e.g. co-agent / listing-side thread) when no CRM row links the pair
  IF NOT v_linked
     AND EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE ap.id = auth.uid())
     AND EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE ap.id = v_other)
  THEN
    v_linked := true;
  END IF;

  IF NOT v_linked THEN
    RAISE EXCEPTION 'No active agent-client link, peer-agent context, or listing-scoped thread for this conversation'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT p_conversation_id, x
  FROM (
    SELECT v_a AS x
    UNION ALL
    SELECT v_b
  ) s
  WHERE x IS NOT NULL
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
END;
$$;

ALTER FUNCTION public.ensure_conversation_participants_for_caller(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.ensure_conversation_participants_for_caller(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_conversation_participants_for_caller(uuid) TO authenticated;

COMMENT ON FUNCTION public.ensure_conversation_participants_for_caller(uuid) IS
  'Idempotent participant rows; caller must be agent_a or agent_b. Validates listing scope, CRM link, or peer agents before insert. INSERT ... ON CONFLICT DO NOTHING only.';

-- get_client_favorites_for_agent: authorize like the success-hub buyer mirror (CRM clients row + agent),
-- not only legacy client_agent_relationships.client_id (auth uid).
-- Favorites remain keyed by auth: favorites.user_id = p_buyer_user_id.

DROP FUNCTION IF EXISTS public.get_client_favorites_for_agent(uuid);

CREATE OR REPLACE FUNCTION public.get_client_favorites_for_agent(
  p_buyer_user_id uuid,
  p_crm_client_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  listing_id uuid,
  created_at timestamptz,
  address text,
  city text,
  state text,
  zip_code text,
  price numeric,
  bedrooms integer,
  bathrooms numeric,
  square_feet integer,
  property_type text,
  photos jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Optional: ensure the auth id we read favorites for belongs to this CRM contact
  IF p_crm_client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = p_crm_client_id
        AND (
          (c.agent_user_id IS NOT NULL AND c.agent_user_id = p_buyer_user_id)
          OR (
            c.agent_user_id IS NULL
            AND c.email IS NOT NULL
            AND trim(c.email) <> ''
            AND EXISTS (
              SELECT 1
              FROM public.profiles p
              WHERE p.id = p_buyer_user_id
                AND lower(trim(p.email)) = lower(trim(c.email))
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'Buyer user does not match CRM client record';
    END IF;
  END IF;

  IF NOT (
    (p_crm_client_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = p_crm_client_id
        AND c.agent_id = public.effective_agent_id()
    ))
    OR (p_crm_client_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.client_agent_relationships car
      WHERE car.agent_id = public.effective_agent_id()
        AND car.crm_client_id = p_crm_client_id
        AND car.status = 'active'
        AND car.ended_at IS NULL
    ))
    OR EXISTS (
      SELECT 1
      FROM public.client_agent_relationships car
      WHERE car.agent_id = public.effective_agent_id()
        AND car.client_id = p_buyer_user_id
        AND car.status = 'active'
        AND car.ended_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'No active relationship with this client';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.listing_id,
    f.created_at,
    l.address,
    l.city,
    l.state,
    l.zip_code,
    l.price,
    l.bedrooms,
    l.bathrooms,
    l.square_feet,
    l.property_type,
    l.photos
  FROM public.favorites f
  JOIN public.listings l ON l.id = f.listing_id
  WHERE f.user_id = p_buyer_user_id
  ORDER BY f.created_at DESC;
END;
$$;

ALTER FUNCTION public.get_client_favorites_for_agent(uuid, uuid) OWNER TO postgres;

GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(uuid, uuid) TO anon;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(uuid, uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(uuid, uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(uuid, uuid) TO sandbox_exec;

-- Agent mirror: remove a buyer's generic MLS favorite (same auth as get_client_favorites_for_agent).

CREATE OR REPLACE FUNCTION public.remove_client_favorite_for_agent(
  p_favorite_id uuid,
  p_buyer_user_id uuid,
  p_crm_client_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_crm_client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = p_crm_client_id
        AND (
          (c.agent_user_id IS NOT NULL AND c.agent_user_id = p_buyer_user_id)
          OR (
            c.agent_user_id IS NULL
            AND c.email IS NOT NULL
            AND trim(c.email) <> ''
            AND EXISTS (
              SELECT 1
              FROM public.profiles p
              WHERE p.id = p_buyer_user_id
                AND lower(trim(p.email)) = lower(trim(c.email))
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'Buyer user does not match CRM client record';
    END IF;
  END IF;

  IF NOT (
    (p_crm_client_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = p_crm_client_id
        AND c.agent_id = public.effective_agent_id()
    ))
    OR (p_crm_client_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.client_agent_relationships car
      WHERE car.agent_id = public.effective_agent_id()
        AND car.crm_client_id = p_crm_client_id
        AND car.status = 'active'
        AND car.ended_at IS NULL
    ))
    OR EXISTS (
      SELECT 1
      FROM public.client_agent_relationships car
      WHERE car.agent_id = public.effective_agent_id()
        AND car.client_id = p_buyer_user_id
        AND car.status = 'active'
        AND car.ended_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'No active relationship with this client';
  END IF;

  DELETE FROM public.favorites f
  WHERE f.id = p_favorite_id
    AND f.user_id = p_buyer_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Favorite not found';
  END IF;
END;
$$;

ALTER FUNCTION public.remove_client_favorite_for_agent(uuid, uuid, uuid) OWNER TO postgres;

GRANT ALL ON FUNCTION public.remove_client_favorite_for_agent(uuid, uuid, uuid) TO anon;
GRANT ALL ON FUNCTION public.remove_client_favorite_for_agent(uuid, uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.remove_client_favorite_for_agent(uuid, uuid, uuid) TO service_role;

-- Phase 2 does not enable agent_account_delegates. Flag must remain false until
-- explicit rollout after frontend + edge functions are ready.
