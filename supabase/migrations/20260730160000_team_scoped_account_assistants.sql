-- =============================================================================
-- Team-scoped assistants on agent_account_members
-- Extends the existing account-delegate system (no second assistant table).
-- =============================================================================

-- 1. Nullable team scope
ALTER TABLE public.agent_account_members
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS agent_account_members_team_id_idx
  ON public.agent_account_members (team_id)
  WHERE team_id IS NOT NULL;

-- 2. Replace uniqueness with scope-aware partial indexes
DROP INDEX IF EXISTS public.agent_account_members_owner_email_invited_uidx;
DROP INDEX IF EXISTS public.agent_account_members_owner_delegate_accepted_uidx;
DROP INDEX IF EXISTS public.agent_account_members_delegate_single_owner_uidx;

-- Personal invited: unique email per owner when team_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS agent_account_members_personal_email_invited_uidx
  ON public.agent_account_members (owner_user_id, invite_email)
  WHERE status = 'invited' AND team_id IS NULL;

-- Team invited: unique email per team
CREATE UNIQUE INDEX IF NOT EXISTS agent_account_members_team_email_invited_uidx
  ON public.agent_account_members (team_id, invite_email)
  WHERE status = 'invited' AND team_id IS NOT NULL;

-- Personal accepted: unique delegate per owner (personal only)
CREATE UNIQUE INDEX IF NOT EXISTS agent_account_members_personal_delegate_accepted_uidx
  ON public.agent_account_members (owner_user_id, delegate_user_id)
  WHERE status = 'accepted' AND team_id IS NULL AND delegate_user_id IS NOT NULL;

-- Team accepted: unique delegate per team
CREATE UNIQUE INDEX IF NOT EXISTS agent_account_members_team_delegate_accepted_uidx
  ON public.agent_account_members (team_id, delegate_user_id)
  WHERE status = 'accepted' AND team_id IS NOT NULL AND delegate_user_id IS NOT NULL;

-- At most one accepted personal ownership context per delegate (still allow
-- multiple team assistant memberships + one personal).
CREATE UNIQUE INDEX IF NOT EXISTS agent_account_members_delegate_single_personal_uidx
  ON public.agent_account_members (delegate_user_id)
  WHERE status = 'accepted' AND team_id IS NULL AND delegate_user_id IS NOT NULL;

COMMENT ON COLUMN public.agent_account_members.team_id IS
  'NULL = personal assistant for owner_user_id; non-NULL = assistant for that team only.';

-- 3. Personal delegate checks must ignore team-scoped rows
CREATE OR REPLACE FUNCTION public.is_accepted_delegate_for(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_account_members m
    WHERE m.owner_user_id = p_owner_user_id
      AND m.delegate_user_id = auth.uid()
      AND m.status = 'accepted'
      AND m.team_id IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_delegate()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_account_members m
    WHERE m.delegate_user_id = auth.uid()
      AND m.status = 'accepted'
      AND m.team_id IS NULL
  );
$$;

-- Team assistant check (operational team access; never satisfies personal impersonation)
CREATE OR REPLACE FUNCTION public.is_accepted_team_assistant(p_team_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_account_members m
    WHERE m.team_id = p_team_id
      AND m.delegate_user_id = p_user_id
      AND m.status = 'accepted'
      AND m.team_id IS NOT NULL
  );
$$;

-- Who may manage (invite/edit/revoke) team assistants
CREATE OR REPLACE FUNCTION public.can_manage_team_assistants(p_team_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND (
      public.has_role(p_user_id, 'admin')
      OR public.is_team_lead(p_team_id, p_user_id)
      OR public.is_team_delegate(p_team_id, p_user_id)
    );
$$;

-- Extend team manager to include accepted team assistants for operational actions
CREATE OR REPLACE FUNCTION public.is_team_manager(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.is_team_lead(_team_id, _user_id)
    OR public.is_team_delegate(_team_id, _user_id)
    OR public.is_accepted_team_assistant(_team_id, _user_id);
$$;

-- current_account_owner_id: only personal accepted memberships
CREATE OR REPLACE FUNCTION public.current_account_owner_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ctx uuid;
  v_expires timestamptz;
  v_count int;
  v_single uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT public.is_feature_enabled('agent_account_delegates') THEN
    RETURN v_uid;
  END IF;

  PERFORM public._purge_expired_agent_active_context();

  SELECT active_owner_user_id, expires_at
    INTO v_ctx, v_expires
  FROM public.agent_active_context
  WHERE user_id = v_uid;

  IF v_ctx IS NOT NULL THEN
    IF v_expires <= now() THEN
      DELETE FROM public.agent_active_context WHERE user_id = v_uid;
    ELSIF v_ctx = v_uid THEN
      RETURN v_ctx;
    ELSIF public.is_accepted_delegate_for(v_ctx) THEN
      RETURN v_ctx;
    ELSE
      DELETE FROM public.agent_active_context WHERE user_id = v_uid;
    END IF;
  END IF;

  SELECT count(*)::int, min(m.owner_user_id)
    INTO v_count, v_single
  FROM public.agent_account_members m
  WHERE m.delegate_user_id = v_uid
    AND m.status = 'accepted'
    AND m.team_id IS NULL;

  IF v_count = 1 THEN
    RETURN v_single;
  END IF;

  IF public.is_licensed_owner() THEN
    RETURN v_uid;
  END IF;

  RETURN v_uid;
END;
$$;

-- list personal assistants only
CREATE OR REPLACE FUNCTION public.list_account_delegates_for_owner()
RETURNS TABLE (
  member_id uuid,
  delegate_user_id uuid,
  invite_email text,
  display_name text,
  role_label text,
  status public.agent_delegate_status,
  invited_at timestamptz,
  accepted_at timestamptz,
  last_active_at timestamptz,
  is_online boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.delegate_user_id,
    m.invite_email,
    m.display_name,
    m.role_label,
    m.status,
    m.invited_at,
    m.accepted_at,
    m.last_active_at,
    CASE
      WHEN m.delegate_user_id IS NULL THEN false
      ELSE EXISTS (
        SELECT 1
        FROM public.agent_settings s
        WHERE s.user_id = m.delegate_user_id
          AND s.last_seen_at > now() - interval '5 minutes'
      )
    END AS is_online
  FROM public.agent_account_members m
  WHERE m.owner_user_id = auth.uid()
    AND m.team_id IS NULL
    AND m.status IN ('invited', 'accepted')
  ORDER BY
    CASE m.status WHEN 'accepted' THEN 0 ELSE 1 END,
    m.display_name NULLS LAST,
    m.invite_email;
$$;

-- list team assistants only (never personal rows)
CREATE OR REPLACE FUNCTION public.list_account_delegates_for_team(p_team_id uuid)
RETURNS TABLE (
  member_id uuid,
  delegate_user_id uuid,
  invite_email text,
  display_name text,
  role_label text,
  status public.agent_delegate_status,
  invited_at timestamptz,
  accepted_at timestamptz,
  last_active_at timestamptz,
  is_online boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_team_id IS NULL THEN
    RAISE EXCEPTION 'team_id_required';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.can_manage_team_assistants(p_team_id, auth.uid())
     AND NOT public.is_accepted_team_assistant(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.delegate_user_id,
    m.invite_email,
    m.display_name,
    m.role_label,
    m.status,
    m.invited_at,
    m.accepted_at,
    m.last_active_at,
    CASE
      WHEN m.delegate_user_id IS NULL THEN false
      ELSE EXISTS (
        SELECT 1
        FROM public.agent_settings s
        WHERE s.user_id = m.delegate_user_id
          AND s.last_seen_at > now() - interval '5 minutes'
      )
    END AS is_online
  FROM public.agent_account_members m
  WHERE m.team_id = p_team_id
    AND m.status IN ('invited', 'accepted')
  ORDER BY
    CASE m.status WHEN 'accepted' THEN 0 ELSE 1 END,
    m.display_name NULLS LAST,
    m.invite_email;
END;
$$;

-- list_delegate_memberships: personal only (account switcher)
CREATE OR REPLACE FUNCTION public.list_delegate_memberships()
RETURNS TABLE (
  owner_user_id uuid,
  owner_first_name text,
  owner_last_name text,
  role_label text,
  display_name text,
  last_active_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.owner_user_id,
    ap.first_name,
    ap.last_name,
    m.role_label,
    m.display_name,
    m.last_active_at
  FROM public.agent_account_members m
  LEFT JOIN public.agent_profiles ap ON ap.id = m.owner_user_id
  WHERE m.delegate_user_id = auth.uid()
    AND m.status = 'accepted'
    AND m.team_id IS NULL
  ORDER BY ap.last_name NULLS LAST, ap.first_name NULLS LAST;
$$;

-- set_active_owner_context: touch only personal membership last_active
CREATE OR REPLACE FUNCTION public.set_active_owner_context(p_owner_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_first text;
  v_last text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_feature_enabled('agent_account_delegates') THEN
    IF p_owner_user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'delegates_disabled';
    END IF;
    RETURN jsonb_build_object('owner_user_id', v_uid, 'is_account_owner', true);
  END IF;

  v_owner := p_owner_user_id;

  IF v_owner = v_uid THEN
    IF NOT public.is_licensed_owner() THEN
      RAISE EXCEPTION 'invalid_owner_context';
    END IF;
  ELSIF NOT public.is_accepted_delegate_for(v_owner) THEN
    RAISE EXCEPTION 'invalid_delegation';
  END IF;

  INSERT INTO public.agent_active_context (user_id, active_owner_user_id, expires_at, updated_at)
  VALUES (v_uid, v_owner, now() + interval '12 hours', now())
  ON CONFLICT (user_id) DO UPDATE
  SET active_owner_user_id = EXCLUDED.active_owner_user_id,
      expires_at = EXCLUDED.expires_at,
      updated_at = now();

  IF v_owner <> v_uid THEN
    UPDATE public.agent_account_members
    SET last_active_at = now(), updated_at = now()
    WHERE owner_user_id = v_owner
      AND delegate_user_id = v_uid
      AND status = 'accepted'
      AND team_id IS NULL;
  END IF;

  SELECT ap.first_name, ap.last_name
    INTO v_first, v_last
  FROM public.agent_profiles ap
  WHERE ap.id = v_owner;

  RETURN jsonb_build_object(
    'owner_user_id', v_owner,
    'is_account_owner', v_owner = v_uid,
    'owner_first_name', v_first,
    'owner_last_name', v_last
  );
END;
$$;

-- Team deletion / ownership: require real lead or admin (not team assistant alone)
CREATE OR REPLACE FUNCTION public.can_delete_or_transfer_team(p_team_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_id IS NOT NULL
    AND (
      public.has_role(p_user_id, 'admin')
      OR public.is_team_lead(p_team_id, p_user_id)
    );
$$;

REVOKE ALL ON FUNCTION public.is_accepted_team_assistant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_team_assistants(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_account_delegates_for_team(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_delete_or_transfer_team(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_accepted_team_assistant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_team_assistants(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_account_delegates_for_team(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_delete_or_transfer_team(uuid, uuid) TO authenticated;
