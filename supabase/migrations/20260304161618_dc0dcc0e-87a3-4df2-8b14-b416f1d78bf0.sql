
-- 1) Buyer workspaces table
CREATE TABLE public.buyer_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(owner_id)
);

ALTER TABLE public.buyer_workspaces ENABLE ROW LEVEL SECURITY;

-- 2) Buyer workspace members table
CREATE TABLE public.buyer_workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.buyer_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.buyer_workspace_members ENABLE ROW LEVEL SECURITY;

-- 3) Helper: is_buyer_workspace_member
CREATE OR REPLACE FUNCTION public.is_buyer_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buyer_workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
  );
$$;

-- 4) Helper: is_buyer_workspace_owner
CREATE OR REPLACE FUNCTION public.is_buyer_workspace_owner(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buyer_workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

-- 5) RLS policies for buyer_workspaces
CREATE POLICY "Members can view workspace"
  ON public.buyer_workspaces FOR SELECT TO authenticated
  USING (public.is_buyer_workspace_member(id));

CREATE POLICY "Owner can update workspace"
  ON public.buyer_workspaces FOR UPDATE TO authenticated
  USING (public.is_buyer_workspace_owner(id));

-- 6) RLS policies for buyer_workspace_members
CREATE POLICY "Members can view workspace members"
  ON public.buyer_workspace_members FOR SELECT TO authenticated
  USING (public.is_buyer_workspace_member(workspace_id));

CREATE POLICY "Owner can insert workspace members"
  ON public.buyer_workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.is_buyer_workspace_owner(workspace_id));

CREATE POLICY "Owner can delete workspace members"
  ON public.buyer_workspace_members FOR DELETE TO authenticated
  USING (public.is_buyer_workspace_owner(workspace_id));

-- 7) Auto-create workspace on buyer role assignment
CREATE OR REPLACE FUNCTION public.auto_create_buyer_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'buyer' THEN
    INSERT INTO public.buyer_workspaces (owner_id)
    VALUES (NEW.user_id)
    ON CONFLICT (owner_id) DO NOTHING;

    INSERT INTO public.buyer_workspace_members (workspace_id, user_id, role)
    SELECT bw.id, NEW.user_id, 'owner'
    FROM public.buyer_workspaces bw
    WHERE bw.owner_id = NEW.user_id
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_buyer_workspace
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_buyer_workspace();

-- 8) Saved searches table (workspace-scoped)
CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_workspace_id uuid NOT NULL REFERENCES public.buyer_workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  search_url text NOT NULL,
  criteria jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view saved searches"
  ON public.saved_searches FOR SELECT TO authenticated
  USING (public.is_buyer_workspace_member(buyer_workspace_id));

CREATE POLICY "Workspace members can insert saved searches"
  ON public.saved_searches FOR INSERT TO authenticated
  WITH CHECK (public.is_buyer_workspace_member(buyer_workspace_id));

CREATE POLICY "Workspace members can delete saved searches"
  ON public.saved_searches FOR DELETE TO authenticated
  USING (public.is_buyer_workspace_member(buyer_workspace_id));

CREATE INDEX idx_saved_searches_workspace ON public.saved_searches(buyer_workspace_id);
