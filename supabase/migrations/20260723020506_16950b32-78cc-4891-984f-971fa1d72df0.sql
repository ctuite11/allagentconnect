
-- 1) agent_profiles: revoke anon full SELECT, re-grant only non-PII columns
REVOKE SELECT ON public.agent_profiles FROM anon;
GRANT SELECT (
  id, first_name, last_name, company, bio, social_links,
  buyer_incentives, seller_incentives, aac_id, headshot_url,
  logo_url, office_name, office_address, title,
  office_city, office_state, office_zip,
  header_background_type, header_background_value, header_image_url,
  team_name, created_at, updated_at, receive_buyer_alerts
) ON public.agent_profiles TO anon;

-- 2) hot_sheet_comments: restrict UPDATE/DELETE to author or hot sheet owner
DROP POLICY IF EXISTS "Anyone can update their comments" ON public.hot_sheet_comments;
DROP POLICY IF EXISTS "Anyone can delete their comments" ON public.hot_sheet_comments;

CREATE POLICY "Author or hot sheet owner can update comments"
  ON public.hot_sheet_comments FOR UPDATE
  TO public
  USING (
    (sender_id IS NOT NULL AND sender_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.hot_sheets hs
      WHERE hs.id = hot_sheet_comments.hot_sheet_id
        AND public.matches_current_account(hs.user_id)
    )
  )
  WITH CHECK (
    (sender_id IS NOT NULL AND sender_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.hot_sheets hs
      WHERE hs.id = hot_sheet_comments.hot_sheet_id
        AND public.matches_current_account(hs.user_id)
    )
  );

CREATE POLICY "Author or hot sheet owner can delete comments"
  ON public.hot_sheet_comments FOR DELETE
  TO public
  USING (
    (sender_id IS NOT NULL AND sender_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.hot_sheets hs
      WHERE hs.id = hot_sheet_comments.hot_sheet_id
        AND public.matches_current_account(hs.user_id)
    )
  );

-- 3) showing_requests: validate public inserts (SELECT stays restricted to listing agent)
DROP POLICY IF EXISTS "Anyone can create showing requests" ON public.showing_requests;

CREATE POLICY "Public can create validated showing requests"
  ON public.showing_requests FOR INSERT
  TO public
  WITH CHECK (
    length(coalesce(requester_name, '')) BETWEEN 1 AND 120
    AND requester_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND length(requester_email) <= 254
    AND (requester_phone IS NULL OR length(requester_phone) BETWEEN 7 AND 32)
    AND length(coalesce(message, '')) <= 2000
    AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = showing_requests.listing_id)
  );
