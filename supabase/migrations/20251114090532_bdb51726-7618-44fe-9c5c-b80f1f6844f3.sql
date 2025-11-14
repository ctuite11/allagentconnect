-- Fix RLS policy for team_members to allow team creators to add themselves
DROP POLICY IF EXISTS "Team owners can manage members" ON public.team_members;
DROP POLICY IF EXISTS "Users can be added to teams" ON public.team_members;

-- Allow team creators to add themselves as members
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

-- Allow team owners to manage all team members
CREATE POLICY "Team owners can manage their team members"
ON public.team_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.team_members owner
    JOIN public.teams ON teams.id = owner.team_id
    WHERE owner.team_id = team_members.team_id
    AND owner.agent_id = auth.uid()
    AND owner.role = 'owner'
  )
);