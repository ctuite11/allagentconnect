-- Create junction table for many-to-many relationship between hot sheets and clients
CREATE TABLE IF NOT EXISTS public.hot_sheet_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hot_sheet_id uuid NOT NULL REFERENCES public.hot_sheets(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(hot_sheet_id, client_id)
);

-- Enable RLS
ALTER TABLE public.hot_sheet_clients ENABLE ROW LEVEL SECURITY;

-- Users can manage clients for their own hot sheets
CREATE POLICY "Users can view clients for their hot sheets"
  ON public.hot_sheet_clients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hot_sheets
      WHERE hot_sheets.id = hot_sheet_clients.hot_sheet_id
      AND hot_sheets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add clients to their hot sheets"
  ON public.hot_sheet_clients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hot_sheets
      WHERE hot_sheets.id = hot_sheet_clients.hot_sheet_id
      AND hot_sheets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove clients from their hot sheets"
  ON public.hot_sheet_clients
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.hot_sheets
      WHERE hot_sheets.id = hot_sheet_clients.hot_sheet_id
      AND hot_sheets.user_id = auth.uid()
    )
  );

-- Create index for better query performance
CREATE INDEX idx_hot_sheet_clients_hot_sheet ON public.hot_sheet_clients(hot_sheet_id);
CREATE INDEX idx_hot_sheet_clients_client ON public.hot_sheet_clients(client_id);