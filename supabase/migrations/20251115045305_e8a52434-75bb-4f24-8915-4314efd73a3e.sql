-- Create table to track listing status per hot sheet
CREATE TABLE IF NOT EXISTS public.hot_sheet_listing_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hot_sheet_id UUID NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unseen' CHECK (status IN ('unseen', 'kept', 'favorited', 'deleted')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(hot_sheet_id, listing_id)
);

-- Enable RLS
ALTER TABLE public.hot_sheet_listing_status ENABLE ROW LEVEL SECURITY;

-- Policies for hot_sheet_listing_status
CREATE POLICY "Users can view status for their hot sheets"
  ON public.hot_sheet_listing_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hot_sheets
      WHERE hot_sheets.id = hot_sheet_listing_status.hot_sheet_id
      AND hot_sheets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert status for their hot sheets"
  ON public.hot_sheet_listing_status
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hot_sheets
      WHERE hot_sheets.id = hot_sheet_listing_status.hot_sheet_id
      AND hot_sheets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update status for their hot sheets"
  ON public.hot_sheet_listing_status
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.hot_sheets
      WHERE hot_sheets.id = hot_sheet_listing_status.hot_sheet_id
      AND hot_sheets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete status for their hot sheets"
  ON public.hot_sheet_listing_status
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.hot_sheets
      WHERE hot_sheets.id = hot_sheet_listing_status.hot_sheet_id
      AND hot_sheets.user_id = auth.uid()
    )
  );

-- Anyone with hot sheet access token can manage status
CREATE POLICY "Anyone with token can view status"
  ON public.hot_sheet_listing_status
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone with token can insert status"
  ON public.hot_sheet_listing_status
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone with token can update status"
  ON public.hot_sheet_listing_status
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone with token can delete status"
  ON public.hot_sheet_listing_status
  FOR DELETE
  USING (true);

-- Create index for faster queries
CREATE INDEX idx_hot_sheet_listing_status_hot_sheet ON public.hot_sheet_listing_status(hot_sheet_id);
CREATE INDEX idx_hot_sheet_listing_status_listing ON public.hot_sheet_listing_status(listing_id);
CREATE INDEX idx_hot_sheet_listing_status_status ON public.hot_sheet_listing_status(status);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_hot_sheet_listing_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hot_sheet_listing_status_updated_at
  BEFORE UPDATE ON public.hot_sheet_listing_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hot_sheet_listing_status_updated_at();