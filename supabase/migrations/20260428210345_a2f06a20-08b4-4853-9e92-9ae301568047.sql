DROP POLICY IF EXISTS "DEBUG allow all updates" ON public.hot_sheets;

DROP POLICY IF EXISTS "Users can update their own hot sheets" ON public.hot_sheets;
DROP POLICY IF EXISTS "Users can update own hot sheets" ON public.hot_sheets;

CREATE POLICY "Users can update own hot sheets"
ON public.hot_sheets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);