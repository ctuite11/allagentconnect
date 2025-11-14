-- Drop any existing constraint (if it exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'team_members_agent_id_fkey' 
    AND table_name = 'team_members'
  ) THEN
    ALTER TABLE public.team_members DROP CONSTRAINT team_members_agent_id_fkey;
  END IF;
END $$;

-- Add the foreign key constraint fresh
ALTER TABLE public.team_members
ADD CONSTRAINT team_members_agent_id_fkey 
FOREIGN KEY (agent_id) 
REFERENCES public.agent_profiles(id) 
ON DELETE CASCADE;