DROP POLICY IF EXISTS "DEBUG allow all updates" ON public.hot_sheets;

CREATE POLICY "DEBUG allow all updates"
ON public.hot_sheets
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);