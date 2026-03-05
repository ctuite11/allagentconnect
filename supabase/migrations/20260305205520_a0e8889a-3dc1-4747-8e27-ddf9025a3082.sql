
-- Hot Sheet Subscribers table (email-only, no account needed)
CREATE TABLE public.hot_sheet_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_sheet_id uuid NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  unsubscribe_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex')
);

-- Partial unique index: only one active subscription per email per hot sheet
CREATE UNIQUE INDEX uniq_hss_active
ON public.hot_sheet_subscribers (hot_sheet_id, lower(email))
WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.hot_sheet_subscribers ENABLE ROW LEVEL SECURITY;

-- RLS: agents can manage subscribers only for hot sheets they own
CREATE POLICY "Agents manage subscribers for their hot sheets"
ON public.hot_sheet_subscribers
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hot_sheets hs
    WHERE hs.id = hot_sheet_subscribers.hot_sheet_id
      AND hs.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hot_sheets hs
    WHERE hs.id = hot_sheet_subscribers.hot_sheet_id
      AND hs.user_id = auth.uid()
  )
);
