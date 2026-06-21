-- Step 1 of #3: additive RPCs only. Broad SELECT policy is NOT dropped yet.

CREATE OR REPLACE FUNCTION public.resolve_share_token(_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(st) - 'agent_id'
  FROM public.share_tokens st
  WHERE st.token = _token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_share_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_share_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_my_accepted_hot_sheet_tokens()
RETURNS TABLE (
  token text,
  payload jsonb,
  accepted_at timestamptz,
  accepted_by_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT st.token, st.payload, st.accepted_at, st.accepted_by_user_id
  FROM public.share_tokens st
  WHERE st.accepted_at IS NOT NULL
    AND (st.payload->>'type') = 'client_hotsheet_invite'
    AND (
      st.accepted_by_user_id = auth.uid()
      OR lower(st.payload->>'client_email') = (
        SELECT lower(p.email) FROM public.profiles p WHERE p.id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.list_my_accepted_hot_sheet_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_accepted_hot_sheet_tokens() TO authenticated;
