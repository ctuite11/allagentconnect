-- Create helper function to avoid recursive RLS checks
CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND agent_id = p_user_id AND role = 'owner'
  );
$$;

-- Clean up potentially recursive policies
DROP POLICY IF EXISTS "Team owners can manage their team members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can add members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can remove members" ON public.team_members;

-- Allow team creators to add themselves (keep existing if present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='team_members' AND policyname='Team creators can add themselves as members'
  ) THEN
    CREATE POLICY "Team creators can add themselves as members"
    ON public.team_members
    FOR INSERT
    WITH CHECK (
      auth.uid() = agent_id AND
      EXISTS (
        SELECT 1 FROM public.teams
        WHERE teams.id = team_members.team_id
        AND teams.created_by = auth.uid()
      )
    );
  END IF;
END $$;

-- Owners can insert other members
CREATE POLICY "Owners can insert members"
ON public.team_members
FOR INSERT
WITH CHECK ( public.is_team_owner(team_id, auth.uid()) );

-- Owners can update members
CREATE POLICY "Owners can update members"
ON public.team_members
FOR UPDATE
USING ( public.is_team_owner(team_id, auth.uid()) )
WITH CHECK ( public.is_team_owner(team_id, auth.uid()) );

-- Owners can delete members
CREATE POLICY "Owners can delete members"
ON public.team_members
FOR DELETE
USING ( public.is_team_owner(team_id, auth.uid()) );