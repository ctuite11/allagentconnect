CREATE TABLE public.listing_publish_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL UNIQUE,
  listing_id uuid NOT NULL,
  user_id uuid,
  previous_status text,
  new_status text,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','succeeded','failed')),
  errors jsonb,
  source text NOT NULL DEFAULT 'publish_listing',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX listing_publish_audit_listing_idx ON public.listing_publish_audit (listing_id, created_at DESC);

GRANT SELECT ON public.listing_publish_audit TO authenticated;
GRANT ALL ON public.listing_publish_audit TO service_role;
ALTER TABLE public.listing_publish_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listing owner, delegate or admin can read publish audit"
ON public.listing_publish_audit FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_publish_audit.listing_id
      AND public.can_act_for_agent(l.agent_id)
  )
);

COMMENT ON TABLE public.listing_publish_audit IS
  'One row per publish_listing() call (operation_id). A Draft can leave Draft only through a succeeded row here.';

CREATE OR REPLACE FUNCTION public.publish_listing(p_listing_id uuid, p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_l public.listings%ROWTYPE;
  v_existing public.listing_publish_audit%ROWTYPE;
  v_target text;
  v_errors jsonb := '[]'::jsonb;
  v_live boolean;
  v_photo_count int := 0;
  v_dup_status text;
  v_max_year int := extract(year FROM now())::int + 1;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated');
  END IF;
  IF p_listing_id IS NULL OR p_operation_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_request');
  END IF;

  -- Operation IDs are single-use, success or failure.
  SELECT * INTO v_existing FROM public.listing_publish_audit WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing.outcome = 'succeeded' AND v_existing.listing_id = p_listing_id AND v_existing.user_id = v_uid THEN
      RETURN jsonb_build_object('ok', true, 'status', v_existing.new_status, 'replayed', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'operation_already_used');
  END IF;

  SELECT * INTO v_l FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_act_for_agent(v_l.agent_id) THEN
    -- Do not reveal whether the listing exists; still consume the operation.
    INSERT INTO public.listing_publish_audit (operation_id, listing_id, user_id, previous_status, outcome, errors, completed_at)
    VALUES (p_operation_id, p_listing_id, v_uid, v_l.status, 'failed', '[{"field":"listing","message":"not_allowed"}]'::jsonb, now());
    RETURN jsonb_build_object('ok', false, 'code', 'not_allowed');
  END IF;

  v_target := v_l.draft_intended_status;

  IF v_l.status IS DISTINCT FROM 'draft' THEN
    v_errors := v_errors || jsonb_build_object('field','status','section','section-status','message','This listing is not a draft.');
  ELSIF v_target IS NULL OR v_target NOT IN
      ('active','coming_soon','off_market','back_on_market','pending','sold','temporarily_withdrawn','cancelled','expired') THEN
    v_errors := v_errors || jsonb_build_object('field','status','section','section-status','message','Choose the status to publish this listing as.');
  END IF;

  v_live := v_target IN ('active','coming_soon','off_market','back_on_market','pending');

  -- Location
  IF coalesce(btrim(v_l.address),'') IN ('','Draft') THEN
    v_errors := v_errors || jsonb_build_object('field','address','section','section-location','message','Street Address');
  END IF;
  IF coalesce(btrim(v_l.city),'') = '' THEN
    v_errors := v_errors || jsonb_build_object('field','city','section','section-location','message','City/Town');
  END IF;
  IF coalesce(btrim(v_l.state),'') = '' THEN
    v_errors := v_errors || jsonb_build_object('field','state','section','section-location','message','State');
  END IF;
  IF coalesce(btrim(v_l.zip_code),'') = '' THEN
    v_errors := v_errors || jsonb_build_object('field','zip_code','section','section-location','message','ZIP Code');
  END IF;
  IF upper(coalesce(v_l.state,'')) = 'MA' AND coalesce(btrim(v_l.county),'') IN ('','all') THEN
    v_errors := v_errors || jsonb_build_object('field','county','section','section-location','message','County (required for MA)');
  END IF;

  -- Pricing
  IF v_l.listing_type IN ('for_sale','for_private_sale') THEN
    IF NOT (coalesce(v_l.price,0) > 0 OR (coalesce(v_l.price_range_min,0) > 0 AND coalesce(v_l.price_range_max,0) > 0)) THEN
      v_errors := v_errors || jsonb_build_object('field','price','section','section-pricing','message','Listing Price or Price Range');
    END IF;
  ELSIF v_l.listing_type = 'for_rent' THEN
    IF NOT coalesce(v_l.price,0) > 0 THEN
      v_errors := v_errors || jsonb_build_object('field','monthly_rent','section','section-pricing','message','Monthly Rent');
    END IF;
  END IF;
  IF v_l.price_range_min IS NOT NULL AND v_l.price_range_max IS NOT NULL AND v_l.price_range_min > v_l.price_range_max THEN
    v_errors := v_errors || jsonb_build_object('field','price_range_min','section','section-pricing','message','Price Range Min must be <= Price Range Max.');
  END IF;

  -- Listing agreement
  IF v_l.listing_agreement_types IS NULL
     OR jsonb_typeof(v_l.listing_agreement_types) <> 'array'
     OR jsonb_array_length(v_l.listing_agreement_types) = 0 THEN
    v_errors := v_errors || jsonb_build_object('field','listing_agreement_type','section','section-agreement','message','Listing Agreement');
  END IF;

  -- Coming Soon go-live date
  IF v_target = 'coming_soon' AND v_l.go_live_date IS NULL THEN
    v_errors := v_errors || jsonb_build_object('field','go_live_date','section','section-dates','message','Go-Live Date (required for Coming Soon)');
  END IF;

  -- Buyer agent compensation (sale, live statuses)
  IF v_live AND v_l.listing_type = 'for_sale' THEN
    IF v_l.buyer_agent_compensation_offered IS NULL THEN
      v_errors := v_errors || jsonb_build_object('field','buyer_agent_compensation_offered','section','section-compensation','message','Buyer Agent Compensation (Yes or No)');
    ELSIF v_l.buyer_agent_compensation_offered AND NOT coalesce(v_l.commission_rate,0) > 0 THEN
      v_errors := v_errors || jsonb_build_object('field','commission_rate','section','section-compensation','message','Buyer Agent Compensation Rate');
    END IF;
  END IF;

  -- Photos (live statuses): at least one fully uploaded photo
  IF v_live THEN
    IF jsonb_typeof(v_l.photos) = 'array' THEN
      SELECT count(*) INTO v_photo_count
      FROM jsonb_array_elements(v_l.photos) p
      WHERE (jsonb_typeof(p) = 'string' AND btrim(p #>> '{}') ~* '^https?://')
         OR (jsonb_typeof(p) = 'object' AND coalesce(p->>'url','') ~* '^https?://');
    END IF;
    IF v_photo_count = 0 THEN
      v_errors := v_errors || jsonb_build_object('field','photos','section','section-photos','message','At least one listing photo');
    END IF;
  END IF;

  -- Numeric bounds
  IF v_l.year_built IS NOT NULL AND (v_l.year_built < 1600 OR v_l.year_built > v_max_year) THEN
    v_errors := v_errors || jsonb_build_object('field','year_built','section','section-details','message','Year Built must be between 1600 and ' || v_max_year);
  END IF;
  IF v_l.fiscal_year IS NOT NULL AND (v_l.fiscal_year < 1900 OR v_l.fiscal_year > 2100) THEN
    v_errors := v_errors || jsonb_build_object('field','fiscal_year','section','section-details','message','Fiscal Year must be between 1900 and 2100');
  END IF;
  IF v_l.bathrooms IS NOT NULL AND (v_l.bathrooms < 0 OR mod(v_l.bathrooms * 2, 1) <> 0) THEN
    v_errors := v_errors || jsonb_build_object('field','bathrooms','section','section-details','message','Bathrooms must be 0 or more in 0.5 steps');
  END IF;
  IF coalesce(v_l.bedrooms,0) < 0 OR coalesce(v_l.square_feet,0) < 0 OR coalesce(v_l.price,0) < 0 THEN
    v_errors := v_errors || jsonb_build_object('field','numbers','section','section-details','message','Numbers cannot be negative');
  END IF;

  -- Duplicate listing (live statuses)
  IF v_live THEN
    SELECT o.status INTO v_dup_status
    FROM public.listings o
    WHERE o.id <> v_l.id
      AND lower(btrim(o.address)) = lower(btrim(v_l.address))
      AND lower(btrim(o.city)) = lower(btrim(v_l.city))
      AND lower(btrim(o.state)) = lower(btrim(v_l.state))
      AND (coalesce(btrim(v_l.zip_code),'') = '' OR lower(btrim(o.zip_code)) = lower(btrim(v_l.zip_code)))
      AND o.status IN ('active','new','coming_soon','off_market','back_on_market','price_changed','extended','reactivated','under_agreement','pending','contingent')
    LIMIT 1;
    IF v_dup_status IS NOT NULL THEN
      v_errors := v_errors || jsonb_build_object('field','address','section','section-location',
        'message','A listing at this address is already "' || replace(v_dup_status,'_',' ') || '".');
    END IF;
  END IF;

  IF jsonb_array_length(v_errors) > 0 THEN
    -- Expected failure: record and RETURN (no exception) so the row commits and the ID stays consumed.
    INSERT INTO public.listing_publish_audit (operation_id, listing_id, user_id, previous_status, new_status, outcome, errors, completed_at)
    VALUES (p_operation_id, p_listing_id, v_uid, v_l.status, v_target, 'failed', v_errors, now());
    RETURN jsonb_build_object('ok', false, 'code', 'validation_failed', 'errors', v_errors);
  END IF;

  INSERT INTO public.listing_publish_audit (operation_id, listing_id, user_id, previous_status, new_status, outcome)
  VALUES (p_operation_id, p_listing_id, v_uid, v_l.status, v_target, 'pending');

  BEGIN
    PERFORM set_config('aac.publish_op', p_operation_id::text, true);
    UPDATE public.listings
       SET status = v_target, draft_intended_status = NULL
     WHERE id = p_listing_id;
    PERFORM set_config('aac.publish_op', '', true);
  EXCEPTION WHEN OTHERS THEN
    -- Subtransaction rolled back the update only; the audit row survives as failed.
    PERFORM set_config('aac.publish_op', '', true);
    UPDATE public.listing_publish_audit
       SET outcome = 'failed', completed_at = now(),
           errors = jsonb_build_array(jsonb_build_object('field','server','message', SQLERRM))
     WHERE operation_id = p_operation_id;
    RETURN jsonb_build_object('ok', false, 'code', 'publish_failed', 'message', SQLERRM);
  END;

  UPDATE public.listing_publish_audit
     SET outcome = 'succeeded', completed_at = now()
   WHERE operation_id = p_operation_id;

  RETURN jsonb_build_object('ok', true, 'status', v_target);
END;
$$;

REVOKE ALL ON FUNCTION public.publish_listing(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_listing(uuid, uuid) TO authenticated;