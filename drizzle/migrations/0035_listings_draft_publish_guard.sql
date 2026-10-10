CREATE OR REPLACE FUNCTION public.listings_guard_draft_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op text := nullif(current_setting('aac.publish_op', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'New listings must be created as draft (got %). Publish with publish_listing().', coalesce(NEW.status, 'null')
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'draft' AND NEW.status IS DISTINCT FROM 'draft' THEN
    IF v_op IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.listing_publish_audit a
      WHERE a.operation_id::text = v_op
        AND a.listing_id = NEW.id
        AND a.outcome = 'pending'
        AND a.new_status = NEW.status
    ) THEN
      RAISE EXCEPTION 'A draft listing can only be published through publish_listing() (attempted draft -> %).', coalesce(NEW.status, 'null')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.listings_guard_draft_publish() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER aaa_listings_guard_draft_publish
BEFORE INSERT OR UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.listings_guard_draft_publish();

COMMENT ON FUNCTION public.listings_guard_draft_publish() IS
  'Invariant: listings are inserted as draft, and draft -> any other status happens only inside publish_listing() (audited in listing_publish_audit). Rollback: DROP TRIGGER aaa_listings_guard_draft_publish ON public.listings.';