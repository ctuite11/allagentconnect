ALTER TABLE public.agent_account_members
  ADD COLUMN IF NOT EXISTS superseded_invite_tokens text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS agent_account_members_superseded_tokens_gin_idx
  ON public.agent_account_members USING gin (superseded_invite_tokens);

COMMENT ON COLUMN public.agent_account_members.superseded_invite_tokens IS
  'Previous invite_token values invalidated by resend; used to show a clear error on old email links.';

CREATE OR REPLACE FUNCTION public.get_delegate_invite_preview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.agent_account_members%ROWTYPE;
  v_owner public.agent_profiles%ROWTYPE;
  v_auth_user_id uuid;
  v_is_licensed_agent boolean := false;
  v_trimmed text := trim(p_token);
BEGIN
  IF p_token IS NULL OR length(v_trimmed) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'missing_token');
  END IF;

  SELECT * INTO v_invite
  FROM public.agent_account_members m
  WHERE m.invite_token = v_trimmed
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_invite
    FROM public.agent_account_members m
    WHERE v_trimmed = ANY (m.superseded_invite_tokens)
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object('valid', false, 'error', 'superseded');
    END IF;

    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;

  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'revoked');
  END IF;

  IF v_invite.invite_expires_at IS NOT NULL AND v_invite.invite_expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'expired');
  END IF;

  SELECT * INTO v_owner
  FROM public.agent_profiles ap
  WHERE ap.id = v_invite.owner_user_id;

  SELECT u.id INTO v_auth_user_id
  FROM auth.users u
  WHERE lower(u.email) = v_invite.invite_email
  LIMIT 1;

  IF v_auth_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.agent_settings s
      WHERE s.user_id = v_auth_user_id AND s.agent_status = 'verified'
    ) INTO v_is_licensed_agent;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'status', v_invite.status,
    'already_accepted', v_invite.status = 'accepted',
    'invite_email', v_invite.invite_email,
    'display_name', v_invite.display_name,
    'role_label', v_invite.role_label,
    'owner_user_id', v_invite.owner_user_id,
    'owner_first_name', v_owner.first_name,
    'owner_last_name', v_owner.last_name,
    'owner_company', v_owner.company,
    'owner_headshot_url', v_owner.headshot_url,
    'account_exists', v_auth_user_id IS NOT NULL,
    'is_licensed_agent', v_is_licensed_agent,
    'blocked', v_is_licensed_agent,
    'blocked_message',
      CASE WHEN v_is_licensed_agent THEN
        'This email already belongs to a licensed AAC agent. Delegate access for existing agents is coming soon.'
      ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_delegate_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delegate_invite_preview(text) TO anon, authenticated;