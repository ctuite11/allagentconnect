-- Add display_order column to team_members table
ALTER TABLE public.team_members
ADD COLUMN display_order INTEGER DEFAULT 0;

-- Update existing members with sequential order
WITH ordered_members AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY joined_at) - 1 AS order_num
  FROM public.team_members
)
UPDATE public.team_members
SET display_order = ordered_members.order_num
FROM ordered_members
WHERE public.team_members.id = ordered_members.id;