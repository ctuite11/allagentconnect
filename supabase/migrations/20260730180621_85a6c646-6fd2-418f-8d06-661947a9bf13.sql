CREATE OR REPLACE FUNCTION public.is_hot_sheet_participant(p_hot_sheet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hot_sheets hs
    WHERE hs.id = p_hot_sheet_id
      AND (
        -- Platform admin (preserved, matches existing admin policy behavior)
        public.has_role(auth.uid(), 'admin')

        -- Owning agent (or an authorized delegate acting for that account)
        OR public.matches_current_account(hs.user_id)

        -- Client formally linked to THIS hot sheet via an active relationship
        OR EXISTS (
          SELECT 1
          FROM public.client_agent_relationships car
          WHERE car.client_id = auth.uid()
            AND car.agent_id = hs.user_id
            AND car.status = 'active'
            AND car.ended_at IS NULL
            AND (
              car.crm_client_id = hs.client_id
              OR EXISTS (
                SELECT 1
                FROM public.hot_sheet_clients hsc
                WHERE hsc.hot_sheet_id = hs.id
                  AND hsc.client_id = car.crm_client_id
              )
            )
        )

        -- Client who accepted THIS hot sheet's invitation (canonical share token)
        OR EXISTS (
          SELECT 1
          FROM public.share_tokens st
          WHERE st.agent_id = hs.user_id
            AND st.accepted_at IS NOT NULL
            AND coalesce(st.payload->>'type', '') = 'client_hotsheet_invite'
            AND coalesce(st.payload->>'hot_sheet_id', '') = hs.id::text
            AND (
              st.accepted_by_user_id = auth.uid()
              OR nullif(btrim(lower(st.payload->>'client_email')), '') = (
                SELECT nullif(btrim(lower(p.email)), '')
                FROM public.profiles p
                WHERE p.id = auth.uid()
              )
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_hot_sheet_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_hot_sheet_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hot_sheet_participant(uuid) TO service_role;

DROP POLICY IF EXISTS "Agents and clients can view comments" ON public.hot_sheet_comments;
DROP POLICY IF EXISTS "Anyone can add comments" ON public.hot_sheet_comments;
DROP POLICY IF EXISTS "Author or hot sheet owner can update comments" ON public.hot_sheet_comments;
DROP POLICY IF EXISTS "Author or hot sheet owner can delete comments" ON public.hot_sheet_comments;

CREATE POLICY "Participants can view hot sheet comments"
ON public.hot_sheet_comments
FOR SELECT
TO authenticated
USING (public.is_hot_sheet_participant(hot_sheet_id));

CREATE POLICY "Participants can add hot sheet comments"
ON public.hot_sheet_comments
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_hot_sheet_participant(hot_sheet_id)
  AND (sender_id IS NULL OR sender_id = auth.uid())
);

CREATE POLICY "Author or hot sheet owner can update comments"
ON public.hot_sheet_comments
FOR UPDATE
TO authenticated
USING (
  public.is_hot_sheet_participant(hot_sheet_id)
  AND (
    (sender_id IS NOT NULL AND sender_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.hot_sheets hs
      WHERE hs.id = hot_sheet_comments.hot_sheet_id
        AND public.matches_current_account(hs.user_id)
    )
  )
)
WITH CHECK (
  public.is_hot_sheet_participant(hot_sheet_id)
  AND (sender_id IS NULL OR sender_id = auth.uid()
       OR public.has_role(auth.uid(), 'admin')
       OR EXISTS (
         SELECT 1 FROM public.hot_sheets hs
         WHERE hs.id = hot_sheet_comments.hot_sheet_id
           AND public.matches_current_account(hs.user_id)
       ))
);

CREATE POLICY "Author or hot sheet owner can delete comments"
ON public.hot_sheet_comments
FOR DELETE
TO authenticated
USING (
  public.is_hot_sheet_participant(hot_sheet_id)
  AND (
    (sender_id IS NOT NULL AND sender_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.hot_sheets hs
      WHERE hs.id = hot_sheet_comments.hot_sheet_id
        AND public.matches_current_account(hs.user_id)
    )
  )
);

REVOKE ALL ON public.hot_sheet_comments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hot_sheet_comments TO authenticated;
GRANT ALL ON public.hot_sheet_comments TO service_role;