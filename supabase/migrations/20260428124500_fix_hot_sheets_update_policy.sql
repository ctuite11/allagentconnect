-- Ensure authenticated users can update only their own hot sheets.
-- This explicitly restores the intended ownership check for UPDATE.

DROP POLICY IF EXISTS "Users can update own hot sheets" ON public.hot_sheets;
DROP POLICY IF EXISTS "Users can update their own hot sheets" ON public.hot_sheets;

CREATE POLICY "Users can update own hot sheets"
ON public.hot_sheets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
