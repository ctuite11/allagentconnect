
-- Remove unused agent_id column
ALTER TABLE public.hot_sheet_subscribers
DROP CONSTRAINT IF EXISTS hot_sheet_subscribers_agent_id_fkey;

ALTER TABLE public.hot_sheet_subscribers
DROP COLUMN IF EXISTS agent_id;

-- Recreate ownership policy based on hot sheet owner
DROP POLICY IF EXISTS "Agents manage subscribers for their hot sheets"
ON public.hot_sheet_subscribers;

CREATE POLICY "Agents manage subscribers for their hot sheets"
ON public.hot_sheet_subscribers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.hot_sheets hs
    WHERE hs.id = hot_sheet_subscribers.hot_sheet_id
      AND hs.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.hot_sheets hs
    WHERE hs.id = hot_sheet_subscribers.hot_sheet_id
      AND hs.user_id = auth.uid()
  )
);

-- Enforce lowercase email storage
ALTER TABLE public.hot_sheet_subscribers
ADD CONSTRAINT hot_sheet_subscribers_email_lower
CHECK (email = lower(email));

-- Prevent duplicate active subscribers (drop old unique constraint first)
ALTER TABLE public.hot_sheet_subscribers
DROP CONSTRAINT IF EXISTS hot_sheet_subscribers_hot_sheet_id_email_key;

DROP INDEX IF EXISTS uniq_hss_active;

CREATE UNIQUE INDEX uniq_hss_active
ON public.hot_sheet_subscribers (hot_sheet_id, lower(email))
WHERE status = 'active';
