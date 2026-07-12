
-- ============================================================
-- Team Accounts foundation
-- ============================================================

-- 1) teams: new columns ----------------------------------------------------
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS team_lead_user_id uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS requester_role text;

-- Backfill status/lead for existing rows
UPDATE public.teams
   SET status = 'approved',
       approved_at = COALESCE(approved_at, created_at),
       team_lead_user_id = COALESCE(team_lead_user_id, created_by)
 WHERE status IS NULL OR status = 'pending';

-- Slug generator + unique constraint
CREATE OR REPLACE FUNCTION public.slugify_text(_txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM regexp_replace(lower(coalesce(_txt,'')), '[^a-z0-9]+', '-', 'g'));
$$;

-- Backfill slugs (ensuring uniqueness with a numeric suffix if needed)
DO $$
DECLARE
  r record;
  base_slug text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, name FROM public.teams WHERE slug IS NULL OR slug = '' LOOP
    base_slug := public.slugify_text(r.name);
    IF base_slug IS NULL OR length(base_slug) = 0 THEN
      base_slug := 'team';
    END IF;
    candidate := base_slug;
    n := 2;
    WHILE EXISTS (SELECT 1 FROM public.teams WHERE slug = candidate AND id <> r.id) LOOP
      candidate := base_slug || '-' || n;
      n := n + 1;
    END LOOP;
    UPDATE public.teams SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.teams
  ALTER COLUMN slug SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_slug_key'
  ) THEN
    ALTER TABLE public.teams ADD CONSTRAINT teams_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Status check constraint
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_status_check;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_status_check
  CHECK (status IN ('pending','approved','rejected','suspended'));

-- Requester role check
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_requester_role_check;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_requester_role_check
  CHECK (requester_role IS NULL OR requester_role IN ('lead','delegate'));

CREATE INDEX IF NOT EXISTS teams_status_idx ON public.teams(status);
CREATE INDEX IF NOT EXISTS teams_team_lead_idx ON public.teams(team_lead_user_id);

-- 2) team_members: new columns --------------------------------------------
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'invited',
  ADD COLUMN IF NOT EXISTS invited_by uuid,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS invite_token uuid DEFAULT gen_random_uuid();

-- Migrate legacy rows: owner -> lead, existing memberships to accepted
UPDATE public.team_members SET role = 'lead' WHERE role = 'owner';
UPDATE public.team_members
   SET status = 'accepted',
       accepted_at = COALESCE(accepted_at, joined_at, now())
 WHERE status IS NULL OR status = 'invited';

-- Expand role check
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('lead','delegate','member'));

ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_status_check;
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_status_check
  CHECK (status IN ('invited','accepted','declined','removed'));

-- Partial unique index: one accepted team per agent
DROP INDEX IF EXISTS team_members_one_accepted_per_agent;
CREATE UNIQUE INDEX team_members_one_accepted_per_agent
  ON public.team_members(agent_id)
  WHERE status = 'accepted';

-- Partial unique index: one active invite per (team, agent)
DROP INDEX IF EXISTS team_members_active_row_per_team_agent;
CREATE UNIQUE INDEX team_members_active_row_per_team_agent
  ON public.team_members(team_id, agent_id)
  WHERE status IN ('invited','accepted');

-- Invite token unique
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_invite_token_key') THEN
    ALTER TABLE public.team_members ADD CONSTRAINT team_members_invite_token_key UNIQUE (invite_token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS team_members_team_id_status_idx ON public.team_members(team_id, status);
CREATE INDEX IF NOT EXISTS team_members_agent_status_idx  ON public.team_members(agent_id, status);

-- updated_at trigger for team_members
CREATE OR REPLACE FUNCTION public.tg_team_members_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_team_members_touch ON public.team_members;
CREATE TRIGGER trg_team_members_touch
BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.tg_team_members_touch();

-- Enforce single lead per team (only among accepted rows)
CREATE OR REPLACE FUNCTION public.tg_teams_single_lead()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  n int;
BEGIN
  IF NEW.role = 'lead' AND NEW.status = 'accepted' THEN
    SELECT count(*) INTO n
    FROM public.team_members
    WHERE team_id = NEW.team_id
      AND role = 'lead'
      AND status = 'accepted'
      AND id <> NEW.id;
    IF n > 0 THEN
      RAISE EXCEPTION 'Team % already has an accepted lead', NEW.team_id
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_teams_single_lead ON public.team_members;
CREATE TRIGGER trg_teams_single_lead
BEFORE INSERT OR UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.tg_teams_single_lead();

-- 3) Helper functions ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_lead(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id
      AND agent_id = _user_id
      AND role = 'lead'
      AND status = 'accepted'
  ) OR EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = _team_id AND team_lead_user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_delegate(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id
      AND agent_id = _user_id
      AND role = 'delegate'
      AND status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_manager(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.is_team_lead(_team_id, _user_id)
    OR public.is_team_delegate(_team_id, _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_team_member_visible(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id
      AND agent_id = _user_id
      AND status = 'accepted'
  );
$$;

-- 4) RLS rewrite -----------------------------------------------------------
-- Ensure RLS on
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Grants (RLS narrows)
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;

GRANT SELECT ON public.team_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

-- Drop old policies
DROP POLICY IF EXISTS "Anyone can view teams" ON public.teams;
DROP POLICY IF EXISTS "Team creators can insert their own teams" ON public.teams;
DROP POLICY IF EXISTS "Team owners can delete their teams" ON public.teams;
DROP POLICY IF EXISTS "Team owners can update their teams" ON public.teams;
DROP POLICY IF EXISTS "Anyone can view team members" ON public.team_members;
DROP POLICY IF EXISTS "Owners can delete members" ON public.team_members;
DROP POLICY IF EXISTS "Owners can insert members" ON public.team_members;
DROP POLICY IF EXISTS "Owners can update members" ON public.team_members;
DROP POLICY IF EXISTS "Team creators can add themselves as members" ON public.team_members;

-- teams policies
CREATE POLICY "teams_select_public_approved"
ON public.teams FOR SELECT
USING (
  status = 'approved'
  OR created_by = auth.uid()
  OR team_lead_user_id = auth.uid()
  OR public.is_team_manager(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "teams_insert_verified_agent"
ON public.teams FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND status = 'pending'
);

CREATE POLICY "teams_update_manager_or_admin"
ON public.teams FOR UPDATE
TO authenticated
USING (
  public.is_team_manager(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.is_team_manager(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "teams_delete_admin_only"
ON public.teams FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- team_members policies
CREATE POLICY "tm_select_public_accepted"
ON public.team_members FOR SELECT
USING (
  (
    status = 'accepted'
    AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.status = 'approved')
  )
  OR agent_id = auth.uid()
  OR public.is_team_manager(team_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "tm_insert_manager_or_self_pending"
ON public.team_members FOR INSERT
TO authenticated
WITH CHECK (
  public.is_team_manager(team_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR (
    -- allow the requester (team creator) to seed initial rows for a pending team
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND t.created_by = auth.uid()
        AND t.status = 'pending'
    )
  )
);

CREATE POLICY "tm_update_manager_or_self"
ON public.team_members FOR UPDATE
TO authenticated
USING (
  agent_id = auth.uid()
  OR public.is_team_manager(team_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  agent_id = auth.uid()
  OR public.is_team_manager(team_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "tm_delete_manager_or_admin"
ON public.team_members FOR DELETE
TO authenticated
USING (
  public.is_team_manager(team_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
