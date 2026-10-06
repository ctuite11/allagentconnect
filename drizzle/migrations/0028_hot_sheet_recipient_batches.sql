CREATE TABLE public.hot_sheet_recipient_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_sheet_id uuid NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  initial_listing_ids uuid[] NOT NULL DEFAULT '{}',
  invited_at timestamptz,
  initial_batch_queued_at timestamptz,
  recipient_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hot_sheet_id, client_id)
);
COMMENT ON TABLE public.hot_sheet_recipient_batches IS 'Per-recipient first-batch state for a Hot Sheet. Source of truth for whether each attached buyer had their initial selected batch queued. Written only by edge functions (service role).';

GRANT SELECT ON public.hot_sheet_recipient_batches TO authenticated;
GRANT ALL ON public.hot_sheet_recipient_batches TO service_role;

ALTER TABLE public.hot_sheet_recipient_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hot sheet owner can read recipient batches"
ON public.hot_sheet_recipient_batches
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.hot_sheets hs
  WHERE hs.id = hot_sheet_recipient_batches.hot_sheet_id
    AND (hs.user_id = auth.uid() OR public.can_act_for_agent(hs.user_id))
));