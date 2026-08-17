-- Helper: is this user a developer-type account?
CREATE OR REPLACE FUNCTION public.is_developer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'developer'::public.app_role
  );
$$;

REVOKE ALL ON FUNCTION public.is_developer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_developer(uuid) TO authenticated, service_role;

-- Role resolver: developer is a first-class product shell, ranked just below admin.
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
  v_is_developer boolean;
  v_verified  boolean;
  v_is_delegate boolean;
  v_owner_id uuid;
  v_owner_first text;
  v_owner_last text;
  v_dev_accounts jsonb;
  v_dev_count int;
  v_primary_dev_account uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RETURN jsonb_build_object('role', 'unknown', 'is_verified_agent', false);
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') INTO v_is_admin;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'agent') INTO v_is_agent;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'buyer') INTO v_is_buyer;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'developer') INTO v_is_developer;

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
    WHERE m.delegate_user_id = _user_id
      AND m.status = 'accepted'
  ) INTO v_is_delegate;

  -- Development company memberships (company/project authorization layer)
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'account_id', m.account_id,
      'name', a.name,
      'slug', a.slug,
      'member_role', m.role,
      'is_active', a.is_active
    ) ORDER BY a.name), '[]'::jsonb),
    COUNT(*)
  INTO v_dev_accounts, v_dev_count
  FROM public.development_account_members m
  JOIN public.development_accounts a ON a.id = m.account_id
  WHERE m.user_id = _user_id;

  IF v_dev_count = 1 THEN
    SELECT m.account_id INTO v_primary_dev_account
    FROM public.development_account_members m
    WHERE m.user_id = _user_id
    LIMIT 1;
  ELSE
    v_primary_dev_account := NULL;
  END IF;

  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'role', 'admin',
      'is_verified_agent', COALESCE(v_verified, false),
      'is_licensed_owner', public.is_licensed_owner(),
      'is_delegate', v_is_delegate,
      'active_owner_user_id', public.current_account_owner_id(),
      'can_access_success_hub', true,
      'is_developer', v_is_developer,
      'developer_accounts', v_dev_accounts,
      'developer_account_count', v_dev_count,
      'primary_developer_account_id', v_primary_dev_account
    );
  END IF;

  -- Developer accounts get the Developer portal only (no agent shell, no verification gate).
  IF v_is_developer THEN
    RETURN jsonb_build_object(
      'role', 'developer',
      'is_verified_agent', false,
      'is_licensed_owner', false,
      'is_delegate', false,
      'can_access_success_hub', false,
      'is_developer', true,
      'developer_accounts', v_dev_accounts,
      'developer_account_count', v_dev_count,
      'primary_developer_account_id', v_primary_dev_account
    );
  END IF;

  IF v_is_agent AND v_verified THEN
    RETURN jsonb_build_object(
      'role', 'agent',
      'is_verified_agent', true,
      'is_licensed_owner', public.is_licensed_owner(),
      'is_delegate', v_is_delegate,
      'active_owner_user_id', public.current_account_owner_id(),
      'can_access_success_hub', true,
      'is_developer', false
    );
  END IF;

  IF v_is_delegate AND NOT (v_is_agent AND v_verified) THEN
    SELECT m.owner_user_id
      INTO v_owner_id
    FROM public.agent_account_members m
    WHERE m.delegate_user_id = _user_id
      AND m.status = 'accepted'
    ORDER BY m.accepted_at DESC NULLS LAST
    LIMIT 1;

    SELECT ap.first_name, ap.last_name
      INTO v_owner_first, v_owner_last
    FROM public.agent_profiles ap
    WHERE ap.id = v_owner_id;

    RETURN jsonb_build_object(
      'role', 'delegate',
      'is_verified_agent', false,
      'is_licensed_owner', false,
      'is_delegate', true,
      'delegated_owner_user_id', v_owner_id,
      'active_owner_user_id', COALESCE(public.current_account_owner_id(), v_owner_id),
      'owner_display_name', nullif(trim(concat_ws(' ', v_owner_first, v_owner_last)), ''),
      'can_access_success_hub', true,
      'is_developer', false
    );
  END IF;

  IF v_is_agent THEN
    RETURN jsonb_build_object(
      'role', 'agent',
      'is_verified_agent', COALESCE(v_verified, false),
      'is_licensed_owner', public.is_licensed_owner(),
      'is_delegate', v_is_delegate,
      'active_owner_user_id', public.current_account_owner_id(),
      'can_access_success_hub', false,
      'is_developer', false
    );
  END IF;

  IF v_is_buyer THEN
    RETURN jsonb_build_object('role', 'buyer', 'is_verified_agent', false, 'can_access_success_hub', false, 'is_developer', false);
  END IF;

  RETURN jsonb_build_object('role', 'unknown', 'is_verified_agent', false, 'can_access_success_hub', false, 'is_developer', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_user_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_user_role(uuid) TO authenticated;

-- Admin-only: grant / revoke the developer account type
CREATE OR REPLACE FUNCTION public.admin_set_developer_role(_user_id uuid, _enabled boolean DEFAULT true)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF _enabled THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'developer'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _user_id AND role = 'developer'::public.app_role;
  END IF;

  RETURN _enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_developer_role(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_developer_role(uuid, boolean) TO authenticated, service_role;

-- Creating a development company also makes its initial owner a developer account.
CREATE OR REPLACE FUNCTION public.create_development_account(_name text, _slug text, _owner_user_id uuid, _legal_name text DEFAULT NULL::text, _billing_email text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_account_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin role required';
  end if;
  if _owner_user_id is null then
    raise exception 'an initial owner is required';
  end if;

  insert into public.development_accounts (name, legal_name, slug, billing_email)
  values (_name, _legal_name, _slug, _billing_email)
  returning id into v_account_id;

  insert into public.development_account_members (account_id, user_id, role, invited_by, accepted_at)
  values (v_account_id, _owner_user_id, 'owner', auth.uid(), now());

  insert into public.user_roles (user_id, role)
  values (_owner_user_id, 'developer'::public.app_role)
  on conflict (user_id, role) do nothing;

  return v_account_id;
end $function$;