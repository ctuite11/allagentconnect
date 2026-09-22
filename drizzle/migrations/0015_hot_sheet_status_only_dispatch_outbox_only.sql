-- Hot Sheet regression fix.
--
-- 1) Only a genuine status change (or an insert already in a deliverable
--    status) may create a Hot Sheet delivery obligation. Price edits and other
--    property-field edits at an unchanged status now send nothing.
-- 2) Delivery runs exclusively through the durable outbox worker, which always
--    carries the originating event id. The legacy pg_net kick is removed: it
--    could not carry the event id, and without it the downstream matcher fails
--    closed, so it could only ever duplicate or mis-classify a send.

CREATE OR REPLACE FUNCTION public.notify_matching_buyers_on_new_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dispatchable text[] := ARRAY[
    'active','price_changed','back_on_market','off_market','extended',
    'reactivated','contingent','under_agreement','sold','rented',
    'temporarily_withdrawn','expired','canceled','cancelled','coming_soon'
  ];
  v_dedupe_key text;
  v_event_id   uuid;
BEGIN
  IF NEW.status IS NULL OR NOT (NEW.status::text = ANY(v_dispatchable)) THEN
    RETURN NEW;
  END IF;

  -- Same-status UPDATE: no obligation, no event, no email.
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- ---------------------------------------------------------------
  -- PRIMARY OUTBOX WRITE — atomic, deliberately NOT exception wrapped.
  -- ---------------------------------------------------------------
  v_dedupe_key := concat_ws(
    ':',
    NEW.id::text,
    NEW.status::text,
    TG_OP,
    to_char(COALESCE(NEW.updated_at, now()) AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS.US')
  );

  INSERT INTO public.hot_sheet_listing_events
    (listing_id, trigger_op, old_status, new_status, dedupe_key, state)
  VALUES
    (NEW.id, TG_OP, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text ELSE NULL END,
     NEW.status::text, v_dedupe_key, 'pending')
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT e.id INTO v_event_id
    FROM public.hot_sheet_listing_events e
    WHERE e.dedupe_key = v_dedupe_key;
  END IF;

  BEGIN
    PERFORM public.log_hot_sheet_event_stage(
      v_event_id, NEW.id, 'trigger_enqueue', 'recorded',
      jsonb_build_object(
        'trigger_op', TG_OP,
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text ELSE NULL END,
        'new_status', NEW.status::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hot sheet stage log failed for listing %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.dispatch_hot_sheet_listing(uuid)
  IS 'DEPRECATED: legacy pg_net kick, no longer called by notify_matching_buyers_on_new_listing. It cannot carry a Hot Sheet event id, and the matcher fails closed without one. Delivery runs through the durable outbox worker (process-hot-sheet-events).';

DROP TRIGGER IF EXISTS notify_matching_buyers_trigger ON public.listings;
CREATE TRIGGER notify_matching_buyers_trigger
AFTER INSERT OR UPDATE OF status ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.notify_matching_buyers_on_new_listing();