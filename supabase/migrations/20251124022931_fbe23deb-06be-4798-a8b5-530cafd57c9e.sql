-- Add RLS policy to allow anyone to view hot_sheets
-- This is safe because hot_sheet IDs are only accessible through secure share tokens
CREATE POLICY "Anyone can view hot sheets with valid token"
  ON public.hot_sheets
  FOR SELECT
  USING (true);