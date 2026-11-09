-- Fix Draft -> first published listing date; no data backfill and no emails.
-- This BEFORE UPDATE trigger changes only the NEW row of a legitimate publish.
-- It does not execute a second UPDATE or enqueue a notification.
CREATE OR REPLACE FUNCTION public.aac_set_first_market_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'draft'
     AND NEW.status IN ('active','coming_soon','off_market','back_on_market','pending')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.list_date := (now() AT TIME ZONE 'America/New_York')::date;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS aab_listing_first_market_date ON public.listings;
CREATE TRIGGER aab_listing_first_market_date BEFORE UPDATE OF status ON public.listings
FOR EACH ROW WHEN (OLD.status = 'draft' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.aac_set_first_market_date();
-- Existing listing dates are left unchanged except for a separate audited correction
-- to 100 Lovejoy Wharf 12G. Updating list_date alone does not fire status UPDATE triggers.
