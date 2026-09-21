-- Read-only counterpart to claim_agent_activation_token.
-- Returns exactly the same status vocabulary, but NEVER mutates the token row,
-- never marks activation and never mints a session. Used by the /activate
-- setup screen to prefill the agent's known details before they submit.
CREATE OR REPLACE FUNCTION public.preview_agent_activation_token(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _row  public.agent_activation_tokens%ROWTYPE;
  _ack  boolean;
  _email text;
  _first text;
  _last  text;
  _company text;
BEGIN
  PERFORM public.assert_service_role();

  SELECT * INTO _row
  FROM public.agent_activation_tokens
  WHERE token_hash = lower(p_token_hash);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF _row.status = 'redeemed' THEN
    RETURN jsonb_build_object('status', 'used', 'token_id', _row.id);
  END IF;

  IF _row.status = 'revoked' THEN
    RETURN jsonb_build_object('status', 'revoked', 'token_id', _row.id);
  END IF;

  IF _row.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired', 'token_id', _row.id);
  END IF;

  IF _row.status = 'redeeming' AND _row.redeeming_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('status', 'in_progress', 'token_id', _row.id);
  END IF;

  _ack := coalesce(_row.allow_previously_deleted, false);

  IF NOT (
    public.agent_is_activation_eligible(_row.user_id, _ack)
    OR public.developer_is_activation_eligible(_row.user_id, _ack)
  ) THEN
    RETURN jsonb_build_object('status', 'ineligible', 'token_id', _row.id);
  END IF;

  SELECT u.email INTO _email FROM auth.users u WHERE u.id = _row.user_id;

  SELECT p.first_name, p.last_name, p.company
    INTO _first, _last, _company
  FROM public.agent_profiles p
  WHERE p.id = _row.user_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'token_id', _row.id,
    'user_id', _row.user_id,
    'expires_at', _row.expires_at,
    'email', _email,
    'first_name', _first,
    'last_name', _last,
    'company', _company
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_agent_activation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_agent_activation_token(text) TO service_role;