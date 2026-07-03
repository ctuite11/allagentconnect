CREATE UNIQUE INDEX IF NOT EXISTS agent_account_members_delegate_single_owner_uidx
  ON public.agent_account_members (delegate_user_id)
  WHERE status = 'accepted' AND delegate_user_id IS NOT NULL;

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
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'missing_token');
  END IF;

  SELECT * INTO v_invite
  FROM public.agent_account_members m
  WHERE m.invite_token = trim(p_token)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;

  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'revoked');
  END IF;

  IF v_invite.invite_expires_at IS NOT NULL AND v_invite.invite_expires_at <= now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'expired');
  END IF;

  SELECT * INTO v_owner FROM public.agent_profiles ap WHERE ap.id = v_invite.owner_user_id;

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
  v_is_delegate boolean;
  v_owner_id uuid;
  v_owner_first text;
  v_owner_last text;
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

  SELECT EXISTS (
    SELECT 1 FROM public.agent_account_members m
    WHERE m.delegate_user_id = _user_id AND m.status = 'accepted'
  ) INTO v_is_delegate;

  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'is_verified_agent', COALESCE(v_verified, false),
      'is_licensed_owner', public.is_licensed_owner(),
      'is_delegate', v_is_delegate,
      'active_owner_user_id', public.current_account_owner_id(),
      'can_access_success_hub', true
    );
  END IF;

  IF v_is_agent AND v_verified THEN
    RETURN jsonb_build_object(
      'role', 'agent',
      'is_verified_agent', true,
      'is_licensed_owner', public.is_licensed_owner(),
      'is_delegate', v_is_delegate,
      'active_owner_user_id', public.current_account_owner_id(),
      'can_access_success_hub', true
    );
  END IF;

  IF public.is_feature_enabled('agent_account_delegates')
     AND v_is_delegate
     AND NOT (v_is_agent AND v_verified) THEN
    SELECT m.owner_user_id INTO v_owner_id
    FROM public.agent_account_members m
    WHERE m.delegate_user_id = _user_id AND m.status = 'accepted'
    ORDER BY m.accepted_at DESC NULLS LAST
    LIMIT 1;

    SELECT ap.first_name, ap.last_name INTO v_owner_first, v_owner_last
    FROM public.agent_profiles ap WHERE ap.id = v_owner_id;

    RETURN jsonb_build_object(
      'role', 'delegate',
      'is_verified_agent', false,
      'is_licensed_owner', false,
      'is_delegate', true,
      'delegated_owner_user_id', v_owner_id,
      'active_owner_user_id', COALESCE(public.current_account_owner_id(), v_owner_id),
      'owner_display_name', nullif(trim(concat_ws(' ', v_owner_first, v_owner_last)), ''),
      'can_access_success_hub', true
    );
  END IF;

  IF v_is_agent THEN
    RETURN jsonb_build_object(
      'role', 'agent',
      'is_verified_agent', COALESCE(v_verified, false),
      'is_licensed_owner', public.is_licensed_owner(),
      'is_delegate', v_is_delegate,
      'active_owner_user_id', public.current_account_owner_id(),
      'can_access_success_hub', false
    );
  END IF;

  IF v_is_buyer THEN
    RETURN jsonb_build_object('role', 'buyer', 'is_verified_agent', false, 'can_access_success_hub', false);
  END IF;

  RETURN jsonb_build_object('role', 'unknown', 'is_verified_agent', false, 'can_access_success_hub', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_user_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_user_role(uuid) TO authenticated;

INSERT INTO public.feature_flag_users (flag_name, user_id, note)
VALUES ('agent_account_delegates', '1fc50da1-2664-4931-8cab-64e24dc5ed8c', 'Phase 5 owner test — chris@allagentconnect.com')
ON CONFLICT (flag_name, user_id) DO NOTHING;