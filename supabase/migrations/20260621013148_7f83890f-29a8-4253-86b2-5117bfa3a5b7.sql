-- Include agent_id in resolve_share_token output. Required by ShareLinkHandler
-- (primary_agent_id cookie/localStorage) and ClientInvitationSetup (tokenAgentId).
CREATE OR REPLACE FUNCTION public.resolve_share_token(_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(st)
  FROM public.share_tokens st
  WHERE st.token = _token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_share_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_share_token(text) TO anon, authenticated;
