-- Create listing_status_history table
CREATE TABLE public.listing_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id),
  notes text
);

-- Enable RLS
ALTER TABLE public.listing_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agents can view status history for their listings"
  ON public.listing_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings
      WHERE listings.id = listing_status_history.listing_id
      AND listings.agent_id = auth.uid()
    )
  );

CREATE POLICY "System can insert status history"
  ON public.listing_status_history
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_listing_status_history_listing_id ON public.listing_status_history(listing_id);
CREATE INDEX idx_listing_status_history_changed_at ON public.listing_status_history(changed_at DESC);

-- Create function to log status changes
CREATE OR REPLACE FUNCTION public.log_listing_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.listing_status_history (
      listing_id,
      old_status,
      new_status,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for status changes
CREATE TRIGGER on_listing_status_change
  AFTER UPDATE ON public.listings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.log_listing_status_change();

-- Backfill initial status for existing listings
INSERT INTO public.listing_status_history (listing_id, old_status, new_status, changed_at, changed_by)
SELECT 
  id,
  NULL,
  status,
  COALESCE(active_date, created_at),
  agent_id
FROM public.listings
WHERE status = 'active'
ON CONFLICT DO NOTHING;