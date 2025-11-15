-- Fix function search path by dropping trigger first
DROP TRIGGER IF EXISTS update_hot_sheet_listing_status_updated_at ON public.hot_sheet_listing_status;
DROP FUNCTION IF EXISTS public.update_hot_sheet_listing_status_updated_at();

CREATE OR REPLACE FUNCTION public.update_hot_sheet_listing_status_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_hot_sheet_listing_status_updated_at
  BEFORE UPDATE ON public.hot_sheet_listing_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hot_sheet_listing_status_updated_at();