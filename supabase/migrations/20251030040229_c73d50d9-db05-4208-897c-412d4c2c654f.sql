-- Create table for sharing hot sheets with friends
CREATE TABLE IF NOT EXISTS public.hot_sheet_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hot_sheet_id UUID NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(hot_sheet_id, shared_with_email)
);

-- Enable RLS
ALTER TABLE public.hot_sheet_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hot_sheet_shares
CREATE POLICY "Users can view shares for their hot sheets"
ON public.hot_sheet_shares
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hot_sheets
    WHERE hot_sheets.id = hot_sheet_shares.hot_sheet_id
    AND hot_sheets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create shares for their hot sheets"
ON public.hot_sheet_shares
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hot_sheets
    WHERE hot_sheets.id = hot_sheet_shares.hot_sheet_id
    AND hot_sheets.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete shares for their hot sheets"
ON public.hot_sheet_shares
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.hot_sheets
    WHERE hot_sheets.id = hot_sheet_shares.hot_sheet_id
    AND hot_sheets.user_id = auth.uid()
  )
);

-- Add index for faster lookups
CREATE INDEX idx_hot_sheet_shares_hot_sheet_id ON public.hot_sheet_shares(hot_sheet_id);
CREATE INDEX idx_hot_sheet_shares_email ON public.hot_sheet_shares(shared_with_email);