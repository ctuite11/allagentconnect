CREATE OR REPLACE FUNCTION public.hide_first_time_on_mls_from_market_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      NEW.hidden_from_market_activity := true;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'active'
     AND COALESCE(OLD.status, 'draft') = 'draft' THEN
    NEW.hidden_from_market_activity := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hide_first_time_on_mls ON public.listings;

CREATE TRIGGER trg_hide_first_time_on_mls
BEFORE INSERT OR UPDATE OF status ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.hide_first_time_on_mls_from_market_activity();