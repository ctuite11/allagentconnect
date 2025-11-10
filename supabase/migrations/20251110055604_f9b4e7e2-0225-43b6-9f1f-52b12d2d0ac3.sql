-- Create function to update timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create listing_drafts table to store auto-saved form progress
CREATE TABLE IF NOT EXISTS public.listing_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  draft_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.listing_drafts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own drafts"
ON public.listing_drafts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts"
ON public.listing_drafts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
ON public.listing_drafts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
ON public.listing_drafts
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_listing_drafts_updated_at
BEFORE UPDATE ON public.listing_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups by user_id
CREATE INDEX idx_listing_drafts_user_id ON public.listing_drafts(user_id);

-- Ensure only one draft per user (unique constraint)
CREATE UNIQUE INDEX idx_listing_drafts_user_unique ON public.listing_drafts(user_id);