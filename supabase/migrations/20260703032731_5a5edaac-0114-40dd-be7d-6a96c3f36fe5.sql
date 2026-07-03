
-- ============================================================
-- Agent Account Delegates — Phase 1
-- Scaffolding only. Feature flag defaults OFF.
-- No changes to any existing table's RLS policies.
-- ============================================================

-- ---------- agent_account_members ----------
CREATE TABLE IF NOT EXISTS public.agent_account_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'delegate',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_account_members_role_check CHECK (role IN ('owner','delegate')),
  CONSTRAINT agent_account_members_status_check CHECK (status IN ('active','revoked','pending')),
  CONSTRAINT agent_account_members_unique UNIQUE (owner_agent_id, member_user_id)
);

CREATE INDEX IF NOT EXISTS idx_aam_owner ON public.agent_account_members(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_aam_member ON public.agent_account_members(member_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_account_members TO authenticated;
GRANT ALL ON public.agent_account_members TO service_role;

ALTER TABLE public.agent_account_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aam_owner_select" ON public.agent_account_members
  FOR SELECT TO authenticated USING (auth.uid() = owner_agent_id);
CREATE POLICY "aam_member_select" ON public.agent_account_members
  FOR SELECT TO authenticated USING (auth.uid() = member_user_id);
CREATE POLICY "aam_owner_insert" ON public.agent_account_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_agent_id);
CREATE POLICY "aam_owner_update" ON public.agent_account_members
  FOR UPDATE TO authenticated USING (auth.uid() = owner_agent_id) WITH CHECK (auth.uid() = owner_agent_id);
CREATE POLICY "aam_owner_delete" ON public.agent_account_members
  FOR DELETE TO authenticated USING (auth.uid() = owner_agent_id);

-- ---------- agent_active_context ----------
CREATE TABLE IF NOT EXISTS public.agent_active_context (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_owner_agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aac_active_owner ON public.agent_active_context(active_owner_agent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_active_context TO authenticated;
GRANT ALL ON public.agent_active_context TO service_role;

ALTER TABLE public.agent_active_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aac_owner_all" ON public.agent_active_context
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- updated_at triggers ----------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_aam_updated_at ON public.agent_account_members;
CREATE TRIGGER trg_aam_updated_at BEFORE UPDATE ON public.agent_account_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_aac_updated_at ON public.agent_active_context;
CREATE TRIGGER trg_aac_updated_at BEFORE UPDATE ON public.agent_active_context
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------- Feature flag (default OFF) ----------
INSERT INTO public.feature_flags (flag_name, enabled, description)
VALUES ('agent_account_delegates', false, 'Enable Agent Account Delegates (Phase 1 scaffolding). Default OFF.')
ON CONFLICT (flag_name) DO NOTHING;

-- ---------- Helper functions ----------

-- Is the delegates feature currently enabled?
CREATE OR REPLACE FUNCTION public.delegates_enabled()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT enabled FROM public.feature_flags WHERE flag_name = 'agent_account_delegates'), false);
$$;

-- Returns the owner_agent_id whose account the caller is currently acting as.
-- Flag OFF: always returns auth.uid() (identity behavior).
-- Flag ON:  returns agent_active_context.active_owner_agent_id when set, else auth.uid().
CREATE OR REPLACE FUNCTION public.current_account_owner_id()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  active UUID;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  IF NOT public.delegates_enabled() THEN
    RETURN uid;
  END IF;
  SELECT active_owner_agent_id INTO active
  FROM public.agent_active_context WHERE user_id = uid;
  RETURN COALESCE(active, uid);
END;
$$;

-- Is _user_id an active member (delegate or owner) of _owner_agent_id's account?
CREATE OR REPLACE FUNCTION public.is_account_member_of(_user_id UUID, _owner_agent_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    _user_id = _owner_agent_id
    OR EXISTS (
      SELECT 1 FROM public.agent_account_members
      WHERE owner_agent_id = _owner_agent_id
        AND member_user_id = _user_id
        AND status = 'active'
    );
$$;

-- Does _owner_agent_id match the caller's current account context?
-- Flag OFF: equivalent to (_owner_agent_id = auth.uid())
-- Flag ON:  matches active context OR any account the caller is an active member of.
CREATE OR REPLACE FUNCTION public.matches_current_account(_owner_agent_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL OR _owner_agent_id IS NULL THEN RETURN false; END IF;
  IF NOT public.delegates_enabled() THEN
    RETURN _owner_agent_id = uid;
  END IF;
  RETURN _owner_agent_id = public.current_account_owner_id()
      OR public.is_account_member_of(uid, _owner_agent_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delegates_enabled() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_account_owner_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_member_of(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.matches_current_account(UUID) TO authenticated;

-- Rollback notes:
--   DROP FUNCTION public.matches_current_account(UUID);
--   DROP FUNCTION public.is_account_member_of(UUID, UUID);
--   DROP FUNCTION public.current_account_owner_id();
--   DROP FUNCTION public.delegates_enabled();
--   DELETE FROM public.feature_flags WHERE flag_name = 'agent_account_delegates';
--   DROP TABLE public.agent_active_context;
--   DROP TABLE public.agent_account_members;
