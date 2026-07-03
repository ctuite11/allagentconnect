-- =============================================================================
-- Agent Account Delegates — Phase 1 (foundation)
-- Feature flag OFF by default. RLS sweep on existing tables is Phase 2.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'agent_delegate_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.agent_delegate_status AS ENUM (
      'invited',
      'accepted',
      'revoked'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. agent_account_members (membership + invite in one table)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_account_members (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegate_user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_email      text NOT NULL,
  display_name      text,
  role_label        text,
  status            public.agent_delegate_status NOT NULL DEFAULT 'invited',
  invite_token      text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invite_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  invited_by        uuid NOT NULL REFERENCES auth.users(id),
  invited_at        timestamptz NOT NULL DEFAULT now(),
  accepted_at       timestamptz,
  accepted_by       uuid REFERENCES auth.users(id),
  revoked_at        timestamptz,
  revoked_by        uuid REFERENCES auth.users(id),
  last_active_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_account_members_email_lower_chk
    CHECK (invite_email = lower(trim(invite_email))),
  CONSTRAINT agent_account_members_accepted_chk
    CHECK (
      (status = 'accepted' AND delegate_user_id IS NOT NULL AND accepted_at IS NOT NULL)
      OR (status <> 'accepted')
    ),
  CONSTRAINT agent_account_members_revoked_chk
    CHECK (
      (status = 'revoked' AND revoked_at IS NOT NULL)
      OR (status <> 'revoked')
    ),
  CONSTRAINT agent_account_members_no_self_delegate_chk
    CHECK (delegate_user_id IS NULL OR delegate_user_id <> owner_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_account_members_owner_delegate_accepted_uidx
  ON public.agent_account_members (owner_user_id, delegate_user_id)
  WHERE status = 'accepted' AND delegate_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS agent_account_members_owner_email_invited_uidx
  ON public.agent_account_members (owner_user_id, invite_email)
  WHERE status = 'invited';

CREATE INDEX IF NOT EXISTS agent_account_members_delegate_user_id_idx
  ON public.agent_account_members (delegate_user_id)
  WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS agent_account_members_owner_user_id_idx
  ON public.agent_account_members (owner_user_id);

CREATE INDEX IF NOT EXISTS agent_account_members_invite_token_idx
  ON public.agent_account_members (invite_token)
  WHERE status = 'invited';

COMMENT ON TABLE public.agent_account_members IS
  'Delegate memberships for agent accounts. Account identity = owner_user_id.';

-- ---------------------------------------------------------------------------
-- 3. agent_active_context (server-side security binding for RLS; ephemeral)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agent_active_context (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at           timestamptz NOT NULL,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_active_context_expires_at_idx
  ON public.agent_active_context (expires_at);

COMMENT ON TABLE public.agent_active_context IS
  'Ephemeral server-side binding of which owner account the caller is acting for. Not UI state.';

-- ---------------------------------------------------------------------------
-- 4. Audit log extension
-- ---------------------------------------------------------------------------

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS acting_as_user_id uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.audit_logs.acting_as_user_id IS
  'Owner account context when the actor is a delegate (effective owner user id).';

-- ---------------------------------------------------------------------------
-- 5. Feature flag (OFF)
-- ---------------------------------------------------------------------------

INSERT INTO public.feature_flags (flag_name, enabled, description)
VALUES (
  'agent_account_delegates',
  false,
  'Enable agent account delegate invites and acting-as-owner access.'
)
ON CONFLICT (flag_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_licensed_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_settings s
    WHERE s.user_id = auth.uid()
      AND s.agent_status = 'verified'
  );
$$;

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
  );
$$;

CREATE OR REPLACE FUNCTION public.can_act_for_agent(p_agent_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN NOT public.is_feature_enabled('agent_account_delegates') THEN
        p_agent_user_id = auth.uid()
      ELSE
        p_agent_user_id = auth.uid()
        OR public.is_accepted_delegate_for(p_agent_user_id)
    END;
$$;

CREATE OR REPLACE FUNCTION public._purge_expired_agent_active_context()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.agent_active_context
  WHERE user_id = auth.uid()
    AND expires_at <= now();
END;
$$;

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
    AND m.status = 'accepted';

  IF v_count = 1 THEN
    RETURN v_single;
  END IF;

  IF public.is_licensed_owner() THEN
    RETURN v_uid;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.matches_current_account(p_agent_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN NOT public.is_feature_enabled('agent_account_delegates') THEN
        p_agent_user_id = auth.uid()
      ELSE
        public.current_account_owner_id() IS NOT NULL
        AND p_agent_user_id = public.current_account_owner_id()
        AND public.can_act_for_agent(p_agent_user_id)
    END;
$$;

CREATE OR REPLACE FUNCTION public.is_account_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.current_account_owner_id() = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_verified_agent_for_context(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_settings s
    WHERE s.user_id = p_owner_user_id
      AND s.agent_status = 'verified'
  );
$$;

CREATE OR REPLACE FUNCTION public.effective_agent_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_account_owner_id();
$$;

-- ---------------------------------------------------------------------------
-- 7. Context RPCs (SECURITY DEFINER — only way to write agent_active_context)
-- ---------------------------------------------------------------------------

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
      AND status = 'accepted';
  END IF;

  SELECT ap.first_name, ap.last_name
    INTO v_first, v_last
  FROM public.agent_profiles ap
  WHERE ap.id = v_owner;

  RETURN jsonb_build_object(
    'owner_user_id', v_owner,
    'is_account_owner', v_owner = v_uid,
    'owner_first_name', v_first,
    'owner_last_name', v_last,
    'expires_at', (SELECT expires_at FROM public.agent_active_context WHERE user_id = v_uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_active_owner_context()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  DELETE FROM public.agent_active_context WHERE user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_agent_context(p_owner_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_feature_enabled('agent_account_delegates') THEN
    IF p_owner_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'delegates_disabled';
    END IF;
    RETURN true;
  END IF;

  v_current := public.current_account_owner_id();

  IF v_current IS NULL OR v_current IS DISTINCT FROM p_owner_user_id THEN
    DELETE FROM public.agent_active_context WHERE user_id = auth.uid();
    RAISE EXCEPTION 'delegation_context_invalid';
  END IF;

  RETURN true;
END;
$$;

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
  ORDER BY ap.last_name NULLS LAST, ap.first_name NULLS LAST;
$$;

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
    AND m.status IN ('invited', 'accepted')
  ORDER BY
    CASE m.status WHEN 'accepted' THEN 0 ELSE 1 END,
    m.display_name NULLS LAST,
    m.invite_email;
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.is_licensed_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_accepted_delegate_for(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_delegate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_act_for_agent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._purge_expired_agent_active_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_account_owner_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matches_current_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_account_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_verified_agent_for_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.effective_agent_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_active_owner_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_active_owner_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_agent_context(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_licensed_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_accepted_delegate_for(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_delegate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_act_for_agent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_account_owner_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.matches_current_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_verified_agent_for_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_agent_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_owner_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_active_owner_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_agent_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_delegate_memberships() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_account_delegates_for_owner() TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. RLS on new tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.agent_account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_active_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_account_members_select_owner ON public.agent_account_members;
CREATE POLICY agent_account_members_select_owner
  ON public.agent_account_members FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS agent_account_members_select_delegate ON public.agent_account_members;
CREATE POLICY agent_account_members_select_delegate
  ON public.agent_account_members FOR SELECT TO authenticated
  USING (delegate_user_id = auth.uid());

DROP POLICY IF EXISTS agent_account_members_insert_owner ON public.agent_account_members;
CREATE POLICY agent_account_members_insert_owner
  ON public.agent_account_members FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND invited_by = auth.uid()
    AND public.is_licensed_owner()
  );

DROP POLICY IF EXISTS agent_account_members_update_owner ON public.agent_account_members;
CREATE POLICY agent_account_members_update_owner
  ON public.agent_account_members FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS agent_active_context_select_self ON public.agent_active_context;
CREATE POLICY agent_active_context_select_self
  ON public.agent_active_context FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Writes to agent_active_context only via SECURITY DEFINER RPCs (no insert/update policies).
