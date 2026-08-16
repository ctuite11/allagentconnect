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
  v_relevant   boolean;
  v_dedupe_key text;
  v_event_id   uuid;
BEGIN
  IF NEW.status IS NULL OR NOT (NEW.status::text = ANY(v_dispatchable)) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_relevant :=
         OLD.status               IS DISTINCT FROM NEW.status
      OR OLD.state                IS DISTINCT FROM NEW.state
      OR OLD.county               IS DISTINCT FROM NEW.county
      OR OLD.city                 IS DISTINCT FROM NEW.city
      OR OLD.neighborhood         IS DISTINCT FROM NEW.neighborhood
      OR OLD.property_type        IS DISTINCT FROM NEW.property_type
      OR OLD.listing_type         IS DISTINCT FROM NEW.listing_type
      OR OLD.price                IS DISTINCT FROM NEW.price
      OR OLD.bedrooms             IS DISTINCT FROM NEW.bedrooms
      OR OLD.bathrooms            IS DISTINCT FROM NEW.bathrooms
      OR OLD.lot_size             IS DISTINCT FROM NEW.lot_size
      OR OLD.square_feet          IS DISTINCT FROM NEW.square_feet
      OR OLD.parking_spaces       IS DISTINCT FROM NEW.parking_spaces
      OR OLD.garage_spaces        IS DISTINCT FROM NEW.garage_spaces
      OR OLD.total_parking_spaces IS DISTINCT FROM NEW.total_parking_spaces
      OR OLD.agent_id             IS DISTINCT FROM NEW.agent_id;

    IF NOT v_relevant THEN
      RETURN NEW;
    END IF;
  END IF;

  -- ---------------------------------------------------------------
  -- PRIMARY OUTBOX WRITE — atomic, deliberately NOT exception wrapped.
  -- If the delivery obligation cannot be recorded, the listing change
  -- must not commit. Losing the obligation silently is the Ashwood bug.
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

  -- ---------------------------------------------------------------
  -- BEST-EFFORT ONLY: breadcrumb + legacy pg_net kick (latency optimisation).
  -- Never allowed to abort the listing save or the outbox obligation.
  -- ---------------------------------------------------------------
  BEGIN
    PERFORM public.log_hot_sheet_event_stage(
      v_event_id, NEW.id, 'trigger_enqueue', 'recorded',
      jsonb_build_object('trigger_op', TG_OP, 'new_status', NEW.status::text)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hot sheet stage log failed for listing %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    PERFORM public.dispatch_hot_sheet_listing(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'legacy hot sheet kick failed (non-fatal) for listing %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;