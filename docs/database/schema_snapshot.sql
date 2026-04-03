--
-- PostgreSQL database dump
--

\restrict pmwmgoFP679NRHKsKUSmePWwaGeo7METeAUPZG4tMXcf4fvtrErUvaCoM3WhRFU

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: agent_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.agent_status AS ENUM (
    'unverified',
    'pending',
    'verified',
    'restricted',
    'rejected'
);


ALTER TYPE public.agent_status OWNER TO postgres;

--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_role AS ENUM (
    'buyer',
    'agent',
    'admin'
);


ALTER TYPE public.app_role OWNER TO postgres;

--
-- Name: property_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.property_type AS ENUM (
    'single_family',
    'condo',
    'townhouse',
    'multi_family',
    'land',
    'commercial',
    'residential_rental',
    'commercial_rental'
);


ALTER TYPE public.property_type OWNER TO postgres;

--
-- Name: seller_match_outcome; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.seller_match_outcome AS ENUM (
    'pending',
    'no_response',
    'not_a_fit',
    'connected',
    'showing_scheduled',
    'offer_submitted',
    'offer_accepted',
    'closed_won',
    'closed_lost',
    'duplicate',
    'invalid'
);


ALTER TYPE public.seller_match_outcome OWNER TO postgres;

--
-- Name: activate_agent_relationship(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.activate_agent_relationship(_agent_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN public.activate_agent_relationship(_agent_id, NULL);
END;
$$;


ALTER FUNCTION public.activate_agent_relationship(_agent_id uuid) OWNER TO postgres;

--
-- Name: activate_agent_relationship(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.activate_agent_relationship(_agent_id uuid, _crm_client_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _client_id uuid;
  new_id uuid;
  _resolved_crm_client_id uuid;
BEGIN
  _client_id := auth.uid();
  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Auto-fill CRM contact bridge if not provided
  _resolved_crm_client_id := _crm_client_id;

  IF _resolved_crm_client_id IS NULL THEN
    SELECT c.id INTO _resolved_crm_client_id
    FROM public.clients c
    JOIN public.profiles p
      ON lower(c.email) = lower(p.email)
    WHERE p.id = _client_id
      AND c.agent_id = _agent_id
    ORDER BY c.created_at DESC
    LIMIT 1;
  END IF;

  UPDATE public.client_agent_relationships
  SET status = 'inactive',
      ended_at = now()
  WHERE client_id = _client_id
    AND ended_at IS NULL
    AND status = 'active';

  INSERT INTO public.client_agent_relationships
    (client_id, agent_id, status, created_at, ended_at, crm_client_id)
  VALUES
    (_client_id, _agent_id, 'active', now(), NULL, _resolved_crm_client_id)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;


ALTER FUNCTION public.activate_agent_relationship(_agent_id uuid, _crm_client_id uuid) OWNER TO postgres;

--
-- Name: admin_deactivate_buyer(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_deactivate_buyer(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_roles_deleted int := 0;
  v_relationships_ended int := 0;
  v_profile_updated int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- 1) Remove buyer role
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role = 'buyer';
  GET DIAGNOSTICS v_roles_deleted = ROW_COUNT;

  -- 2) End all active relationships
  UPDATE public.client_agent_relationships
  SET status = 'inactive', ended_at = now()
  WHERE client_id = p_user_id AND status = 'active';
  GET DIAGNOSTICS v_relationships_ended = ROW_COUNT;

  -- 3) Soft-deactivate profile
  UPDATE public.profiles
  SET deactivated_at = now()
  WHERE id = p_user_id;
  GET DIAGNOSTICS v_profile_updated = ROW_COUNT;

  -- IMPORTANT: Do NOT touch public.clients (CRM contacts)

  RETURN jsonb_build_object(
    'roles_deleted', v_roles_deleted,
    'relationships_ended', v_relationships_ended,
    'profile_updated', v_profile_updated
  );
END;
$$;


ALTER FUNCTION public.admin_deactivate_buyer(p_user_id uuid) OWNER TO postgres;

--
-- Name: admin_delete_agent(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_delete_agent(p_agent_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Enforce admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- SET NULL on blocker FK columns
  UPDATE public.agent_invites SET accepted_user_id = NULL WHERE accepted_user_id = p_agent_id;
  UPDATE public.listing_status_history SET changed_by = NULL WHERE changed_by = p_agent_id;

  -- Explicit deletes for tables with no CASCADE or no FK at all
  DELETE FROM public.hot_sheet_comments WHERE sender_id = p_agent_id;
  DELETE FROM public.seller_matches WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_match_deliveries WHERE agent_id = p_agent_id;
  DELETE FROM public.conversation_participants WHERE user_id = p_agent_id;
  DELETE FROM public.conversation_messages WHERE sender_agent_id = p_agent_id OR recipient_agent_id = p_agent_id;
  DELETE FROM public.share_tokens WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_notifications WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_messages WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_proposal_incentives WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_license_uploads WHERE user_id = p_agent_id;
  DELETE FROM public.email_campaigns WHERE agent_id = p_agent_id;
  DELETE FROM public.client_agent_relationships WHERE agent_id = p_agent_id;

  -- Hot sheet cascade: remove child rows then hot sheets
  DELETE FROM public.hot_sheet_clients WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_favorites WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_sent_listings WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_notifications WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_listing_status WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_comments WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheets WHERE user_id = p_agent_id;

  -- Listing cascade: remove child rows then listings
  DELETE FROM public.favorite_price_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.favorites WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_status_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_views WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_stats WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.showing_requests WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.agent_messages WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.conversations WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listings WHERE agent_id = p_agent_id;

  -- Remaining agent-specific tables
  DELETE FROM public.listing_drafts WHERE user_id = p_agent_id;
  DELETE FROM public.clients WHERE agent_id = p_agent_id;
  DELETE FROM public.email_templates WHERE agent_id = p_agent_id;
  DELETE FROM public.testimonials WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_buyer_coverage_areas WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_county_preferences WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_state_preferences WHERE agent_id = p_agent_id;
  DELETE FROM public.notification_preferences WHERE user_id = p_agent_id;
  DELETE FROM public.agent_settings WHERE user_id = p_agent_id;
  DELETE FROM public.user_roles WHERE user_id = p_agent_id;
  DELETE FROM public.favorites WHERE user_id = p_agent_id;
  DELETE FROM public.client_needs WHERE submitted_by = p_agent_id;

  -- Profile tables last
  DELETE FROM public.profiles WHERE id = p_agent_id;
  DELETE FROM public.agent_profiles WHERE id = p_agent_id;
END;
$$;


ALTER FUNCTION public.admin_delete_agent(p_agent_id uuid) OWNER TO postgres;

--
-- Name: admin_delete_client(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_delete_client(p_client_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Enforce admin using existing role system
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- FK-safe deletion order
  DELETE FROM public.hot_sheet_clients
  WHERE client_id = p_client_id;

  DELETE FROM public.client_agent_relationships
  WHERE client_id = p_client_id;

  DELETE FROM public.clients
  WHERE id = p_client_id;
END;
$$;


ALTER FUNCTION public.admin_delete_client(p_client_id uuid) OWNER TO postgres;

--
-- Name: admin_delete_consumer(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_delete_consumer(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_email text;
  v_client_ids uuid[];
BEGIN
  -- Enforce admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Resolve email for CRM lookups
  SELECT email INTO v_email FROM public.profiles WHERE id = p_user_id;

  -- SET NULL on blocker FK columns
  UPDATE public.share_tokens SET accepted_by_user_id = NULL WHERE accepted_by_user_id = p_user_id;
  UPDATE public.listing_status_history SET changed_by = NULL WHERE changed_by = p_user_id;

  -- Collect CRM client_ids by email
  IF v_email IS NOT NULL THEN
    SELECT array_agg(id) INTO v_client_ids
    FROM public.clients
    WHERE lower(email) = lower(v_email);
  END IF;

  -- CRM cleanup
  IF v_client_ids IS NOT NULL AND array_length(v_client_ids, 1) > 0 THEN
    DELETE FROM public.hot_sheet_clients WHERE client_id = ANY(v_client_ids);
    DELETE FROM public.client_agent_relationships WHERE client_id = ANY(v_client_ids);
    DELETE FROM public.clients WHERE id = ANY(v_client_ids);
  END IF;

  -- Explicit deletes for consumer-specific tables
  DELETE FROM public.hot_sheet_comments WHERE sender_id = p_user_id;
  DELETE FROM public.conversation_participants WHERE user_id = p_user_id;
  DELETE FROM public.favorites WHERE user_id = p_user_id;
  DELETE FROM public.buyer_credentials WHERE user_id = p_user_id;
  DELETE FROM public.buyer_qualifications WHERE user_id = p_user_id;
  DELETE FROM public.notification_preferences WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION public.admin_delete_consumer(p_user_id uuid) OWNER TO postgres;

--
-- Name: agent_end_client_relationship(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.agent_end_client_relationship(p_client_id uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  rows_affected bigint;
BEGIN
  UPDATE public.client_agent_relationships
  SET status = 'inactive',
      ended_at = now()
  WHERE agent_id = auth.uid()
    AND ended_at IS NULL
    AND status = 'active'
    AND (client_id = p_client_id OR crm_client_id = p_client_id);

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'No active relationship found for agent % with identifier %.', auth.uid(), p_client_id;
  END IF;

  RETURN rows_affected;
END;
$$;


ALTER FUNCTION public.agent_end_client_relationship(p_client_id uuid) OWNER TO postgres;

--
-- Name: auto_activate_listings(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_activate_listings() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.listings
  SET status = 'active'
  WHERE status = 'coming_soon'
    AND activation_date IS NOT NULL
    AND activation_date <= CURRENT_DATE;
END;
$$;


ALTER FUNCTION public.auto_activate_listings() OWNER TO postgres;

--
-- Name: auto_create_buyer_workspace(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_create_buyer_workspace() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.role = 'buyer' THEN
    INSERT INTO public.buyer_workspaces (owner_id)
    VALUES (NEW.user_id)
    ON CONFLICT (owner_id) DO NOTHING;

    INSERT INTO public.buyer_workspace_members (workspace_id, user_id, role)
    SELECT bw.id, NEW.user_id, 'owner'
    FROM public.buyer_workspaces bw
    WHERE bw.owner_id = NEW.user_id
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.auto_create_buyer_workspace() OWNER TO postgres;

--
-- Name: auto_create_conversation_participants(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_create_conversation_participants() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  SELECT NEW.id, uid
  FROM (
    SELECT NEW.agent_a_id AS uid
    UNION
    SELECT NEW.agent_b_id AS uid
  ) s
  WHERE uid IS NOT NULL
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.auto_create_conversation_participants() OWNER TO postgres;

--
-- Name: check_and_link_relisting(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_and_link_relisting() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  previous_listing RECORD;
  days_since_cancelled integer;
BEGIN
  -- Only check for new listings that are active
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    -- Look for previous cancelled/withdrawn listings at the same address by any agent
    SELECT 
      l.id,
      l.agent_id,
      l.cancelled_at,
      l.created_at,
      COALESCE(l.original_listing_id, l.id) as root_listing_id
    INTO previous_listing
    FROM public.listings l
    WHERE l.address = NEW.address
      AND l.city = NEW.city
      AND l.state = NEW.state
      AND l.zip_code = NEW.zip_code
      AND l.id != NEW.id
      AND l.status IN ('cancelled', 'withdrawn', 'temporarily_withdrawn')
    ORDER BY 
      COALESCE(l.cancelled_at, l.updated_at) DESC
    LIMIT 1;

    IF previous_listing.id IS NOT NULL THEN
      days_since_cancelled := CEIL(EXTRACT(EPOCH FROM (NEW.created_at - COALESCE(previous_listing.cancelled_at, previous_listing.created_at))) / 86400);
      
      -- If relisted within 30 days
      IF days_since_cancelled <= 30 THEN
        -- Same agent: Link to original and preserve history
        IF previous_listing.agent_id = NEW.agent_id THEN
          NEW.is_relisting := true;
          NEW.original_listing_id := previous_listing.root_listing_id;
          
          -- Copy status history from previous listing to new listing
          INSERT INTO public.listing_status_history (listing_id, old_status, new_status, changed_at, changed_by, notes)
          SELECT 
            NEW.id,
            old_status,
            new_status,
            changed_at,
            changed_by,
            'Migrated from previous listing due to relisting within 30 days'
          FROM public.listing_status_history
          WHERE listing_id = previous_listing.id
          ORDER BY changed_at ASC;
          
        -- Different agent within 30 days: Treat as new listing
        ELSE
          NEW.is_relisting := false;
          NEW.original_listing_id := NULL;
        END IF;
      -- After 30 days with same agent: Treat as new listing
      ELSE
        NEW.is_relisting := false;
        NEW.original_listing_id := NULL;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_and_link_relisting() OWNER TO postgres;

--
-- Name: check_client_has_other_agent(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_client_has_other_agent(p_client_email text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_agent_relationships car
    JOIN public.clients c ON c.id = car.client_id
    WHERE lower(trim(c.email)) = lower(trim(p_client_email))
      AND car.status = 'active'
      AND car.agent_id <> auth.uid()
  );
$$;


ALTER FUNCTION public.check_client_has_other_agent(p_client_email text) OWNER TO postgres;

--
-- Name: check_hot_sheet_matches(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid) RETURNS TABLE(listing_id uuid)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_criteria JSONB;
  v_user_id UUID;
  v_has_status_filter boolean;
BEGIN
  SELECT criteria, user_id INTO v_criteria, v_user_id
  FROM public.hot_sheets
  WHERE id = p_hot_sheet_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_has_status_filter := (
    v_criteria->'statuses' IS NOT NULL
    AND jsonb_typeof(v_criteria->'statuses') = 'array'
    AND jsonb_array_length(v_criteria->'statuses') > 0
  );

  RETURN QUERY
  SELECT DISTINCT l.id
  FROM public.listings l
  WHERE
    CASE
      WHEN v_has_status_filter THEN
        l.status = ANY(SELECT jsonb_array_elements_text(v_criteria->'statuses'))
      ELSE
        l.status IN ('active', 'new', 'coming_soon', 'off_market', 'back_on_market')
    END
    AND NOT EXISTS (
      SELECT 1 FROM public.hot_sheet_sent_listings hsl
      WHERE hsl.hot_sheet_id = p_hot_sheet_id
        AND hsl.listing_id = l.id
        AND hsl.status_at_send = l.status
    )
    AND (
      (v_criteria->'propertyTypes')::jsonb IS NULL
      OR jsonb_array_length(COALESCE(v_criteria->'propertyTypes', '[]'::jsonb)) = 0
      OR l.property_type = ANY(SELECT jsonb_array_elements_text(v_criteria->'propertyTypes'))
    )
    AND (
      (v_criteria->>'state') IS NULL
      OR l.state = (v_criteria->>'state')
    )
    AND (
      (v_criteria->'cities')::jsonb IS NULL
      OR jsonb_array_length(COALESCE(v_criteria->'cities', '[]'::jsonb)) = 0
      OR l.city = ANY(SELECT jsonb_array_elements_text(v_criteria->'cities'))
    )
    AND (
      (v_criteria->>'maxPrice') IS NULL
      OR l.price <= (v_criteria->>'maxPrice')::numeric
    )
    AND (
      (v_criteria->>'minPrice') IS NULL
      OR l.price >= (v_criteria->>'minPrice')::numeric
    )
    AND (
      (v_criteria->>'bedrooms') IS NULL
      OR l.bedrooms >= (v_criteria->>'bedrooms')::integer
    )
    AND (
      (v_criteria->>'bathrooms') IS NULL
      OR l.bathrooms >= (v_criteria->>'bathrooms')::numeric
    );
END;
$$;


ALTER FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid) OWNER TO postgres;

--
-- Name: check_single_active_agent(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_single_active_agent() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only check for active status
  IF NEW.status = 'active' THEN
    -- Check if another active relationship exists for this client
    IF EXISTS (
      SELECT 1 
      FROM client_agent_relationships 
      WHERE client_id = NEW.client_id 
      AND status = 'active' 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Client can only have one active agent relationship at a time';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_single_active_agent() OWNER TO postgres;

--
-- Name: cleanup_expired_share_tokens(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_expired_share_tokens() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.share_tokens
  WHERE expires_at IS NOT NULL 
    AND expires_at < now();
END;
$$;


ALTER FUNCTION public.cleanup_expired_share_tokens() OWNER TO postgres;

--
-- Name: count_matching_agents(text, text, text, numeric, integer, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.count_matching_agents(p_city text, p_state text, p_property_type text, p_price numeric, p_bedrooms integer, p_bathrooms numeric) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  match_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT hs.user_id)
  INTO match_count
  FROM hot_sheets hs
  INNER JOIN agent_settings ast ON ast.user_id = hs.user_id
  WHERE hs.is_active = true
    AND ast.agent_status = 'verified'
    -- Location match: city in criteria.cities array OR no city filter
    AND (
      hs.criteria->>'cities' IS NULL 
      OR hs.criteria->'cities' @> to_jsonb(ARRAY[p_city])
      OR jsonb_array_length(COALESCE(hs.criteria->'cities', '[]'::jsonb)) = 0
    )
    -- State match
    AND (
      hs.criteria->>'state' IS NULL 
      OR LOWER(hs.criteria->>'state') = LOWER(p_state)
    )
    -- Property type match (if specified in hot sheet)
    AND (
      hs.criteria->>'propertyTypes' IS NULL
      OR jsonb_array_length(COALESCE(hs.criteria->'propertyTypes', '[]'::jsonb)) = 0
      OR hs.criteria->'propertyTypes' @> to_jsonb(ARRAY[p_property_type])
    )
    -- Price within range
    AND (
      (hs.criteria->>'minPrice' IS NULL OR p_price >= (hs.criteria->>'minPrice')::numeric)
      AND (hs.criteria->>'maxPrice' IS NULL OR p_price <= (hs.criteria->>'maxPrice')::numeric)
    )
    -- Bedrooms minimum
    AND (
      hs.criteria->>'bedrooms' IS NULL 
      OR p_bedrooms >= (hs.criteria->>'bedrooms')::integer
    )
    -- Bathrooms minimum
    AND (
      hs.criteria->>'bathrooms' IS NULL 
      OR p_bathrooms >= (hs.criteria->>'bathrooms')::numeric
    );
  
  RETURN COALESCE(match_count, 0);
END;
$$;


ALTER FUNCTION public.count_matching_agents(p_city text, p_state text, p_property_type text, p_price numeric, p_bedrooms integer, p_bathrooms numeric) OWNER TO postgres;

--
-- Name: create_buyer_hot_sheet(text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_buyer_hot_sheet(p_name text, p_criteria jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_buyer_id uuid := auth.uid();
  v_agent_id uuid;
  v_crm_client_id uuid;
  v_hot_sheet_id uuid;
begin
  if v_buyer_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Resolve active agent
  select agent_id into v_agent_id
  from client_agent_relationships
  where client_id = v_buyer_id and status = 'active'
  limit 1;

  if v_agent_id is null then
    raise exception 'No active agent relationship';
  end if;

  -- Resolve CRM client ID via email bridge
  select c.id into v_crm_client_id
  from clients c
  join profiles p on lower(c.email) = lower(p.email)
  where p.id = v_buyer_id and c.agent_id = v_agent_id
  limit 1;

  if v_crm_client_id is null then
    raise exception 'No CRM client record found for this buyer-agent pair';
  end if;

  -- Insert hot sheet (agent-owned)
  insert into hot_sheets (user_id, client_id, name, criteria, is_active,
                          notify_client_email, notify_agent_email, notification_schedule)
  values (v_agent_id, v_crm_client_id, p_name, p_criteria, true,
          true, true, 'immediately')
  returning id into v_hot_sheet_id;

  -- Link buyer via junction table
  insert into hot_sheet_clients (hot_sheet_id, client_id)
  values (v_hot_sheet_id, v_crm_client_id);

  return v_hot_sheet_id;
end;
$$;


ALTER FUNCTION public.create_buyer_hot_sheet(p_name text, p_criteria jsonb) OWNER TO postgres;

--
-- Name: create_seller_match_on_delivery(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_seller_match_on_delivery() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.seller_matches (submission_id, agent_id, hot_sheet_id, delivery_id)
  VALUES (NEW.submission_id, NEW.agent_id, NEW.hot_sheet_id, NEW.id)
  ON CONFLICT (submission_id, agent_id) DO UPDATE SET
    delivery_id = COALESCE(public.seller_matches.delivery_id, EXCLUDED.delivery_id),
    hot_sheet_id = COALESCE(public.seller_matches.hot_sheet_id, EXCLUDED.hot_sheet_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.create_seller_match_on_delivery() OWNER TO postgres;

--
-- Name: delete_draft_listing(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_draft_listing(p_listing_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_listing RECORD;
BEGIN
  -- Get the listing details for better error messages
  SELECT id, agent_id, status, address
  INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id;
  
  -- Check if listing exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found with ID: %', p_listing_id;
  END IF;
  
  -- Check ownership
  IF v_listing.agent_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to delete this listing. You do not own this listing.';
  END IF;
  
  -- Check status (case-insensitive)
  IF LOWER(v_listing.status) != 'draft' THEN
    RAISE EXCEPTION 'Cannot delete listing with status "%". Only draft listings can be deleted. Address: %', v_listing.status, v_listing.address;
  END IF;
  
  -- Delete dependent rows that may block deletion due to FK constraints
  DELETE FROM public.favorite_price_history WHERE listing_id = p_listing_id;
  DELETE FROM public.favorites WHERE listing_id = p_listing_id;
  DELETE FROM public.listing_status_history WHERE listing_id = p_listing_id;
  DELETE FROM public.listing_views WHERE listing_id = p_listing_id;
  DELETE FROM public.hot_sheet_listing_status WHERE listing_id = p_listing_id;
  DELETE FROM public.hot_sheet_notifications WHERE listing_id = p_listing_id;
  DELETE FROM public.hot_sheet_sent_listings WHERE listing_id = p_listing_id;
  DELETE FROM public.hot_sheet_favorites WHERE listing_id = p_listing_id;
  DELETE FROM public.hot_sheet_comments WHERE listing_id = p_listing_id;
  DELETE FROM public.showing_requests WHERE listing_id = p_listing_id;
  DELETE FROM public.agent_messages WHERE listing_id = p_listing_id;
  DELETE FROM public.listing_stats WHERE listing_id = p_listing_id;
  
  -- Finally delete the listing
  DELETE FROM public.listings WHERE id = p_listing_id;
  
  RAISE NOTICE 'Successfully deleted draft listing: %', p_listing_id;
END;
$$;


ALTER FUNCTION public.delete_draft_listing(p_listing_id uuid) OWNER TO postgres;

--
-- Name: delete_hot_sheet_client_needs(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.delete_hot_sheet_client_needs() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM client_needs
  WHERE submitted_by = OLD.user_id
  AND description LIKE '%hot sheet: ' || OLD.name || '%';
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION public.delete_hot_sheet_client_needs() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: email_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    run_after timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    last_error text,
    payload jsonb NOT NULL,
    idempotency_key text,
    CONSTRAINT chk_email_job_status CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT email_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text])))
);


ALTER TABLE public.email_jobs OWNER TO postgres;

--
-- Name: email_jobs_claim(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.email_jobs_claim(p_limit integer) RETURNS SETOF public.email_jobs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT ej.id
    FROM public.email_jobs ej
    WHERE ej.status = 'queued'
      AND ej.run_after <= now()
    ORDER BY ej.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE public.email_jobs
  SET 
    status = 'processing',
    attempts = attempts + 1
  FROM claimed
  WHERE email_jobs.id = claimed.id
  RETURNING email_jobs.*;
END;
$$;


ALTER FUNCTION public.email_jobs_claim(p_limit integer) OWNER TO postgres;

--
-- Name: end_client_relationship(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.end_client_relationship() RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  rows_affected bigint;
BEGIN
  UPDATE public.client_agent_relationships
  SET status = 'inactive', ended_at = now()
  WHERE client_id = auth.uid() AND status = 'active';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'No active relationship found for user % to end.', auth.uid();
  END IF;

  RETURN rows_affected;
END;
$$;


ALTER FUNCTION public.end_client_relationship() OWNER TO postgres;

--
-- Name: enqueue_message_email(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.enqueue_message_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  recipient_email text;
  sender_name text;
  snippet text;
BEGIN
  -- Do not email self-sent
  IF NEW.recipient_agent_id IS NULL OR NEW.sender_agent_id = NEW.recipient_agent_id THEN
    RETURN NEW;
  END IF;

  -- Resolve recipient email: agent_profiles first, then profiles fallback
  SELECT ap.email INTO recipient_email
  FROM public.agent_profiles ap
  WHERE ap.id = NEW.recipient_agent_id;

  IF recipient_email IS NULL THEN
    SELECT p.email INTO recipient_email
    FROM public.profiles p
    WHERE p.id = NEW.recipient_agent_id;
  END IF;

  IF recipient_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve sender display name (agent_profiles then profiles)
  SELECT CONCAT_WS(' ', ap.first_name, ap.last_name) INTO sender_name
  FROM public.agent_profiles ap
  WHERE ap.id = NEW.sender_agent_id;

  IF sender_name IS NULL OR sender_name = '' THEN
    SELECT CONCAT_WS(' ', p.first_name, p.last_name) INTO sender_name
    FROM public.profiles p
    WHERE p.id = NEW.sender_agent_id;
  END IF;

  IF sender_name IS NULL OR sender_name = '' THEN
    sender_name := 'Someone';
  END IF;

  snippet := left(coalesce(NEW.body, ''), 500);

  -- Enqueue email job with RELATIVE cta_url (Edge Function prepends APP_URL)
  INSERT INTO public.email_jobs (payload)
  VALUES (jsonb_build_object(
    'provider', 'resend',
    'template', 'new-message-notification',
    'to', recipient_email,
    'subject', 'New message from ' || sender_name,
    'variables', jsonb_build_object(
      'sender_name', sender_name,
      'message_body', snippet,
      'conversation_id', NEW.conversation_id::text,
      'cta_url', '/messages/' || NEW.conversation_id::text
    )
  ));

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.enqueue_message_email() OWNER TO postgres;

--
-- Name: generate_aac_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_aac_id() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  next_val INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(aac_id FROM 5) AS INTEGER)), 0) + 1
  INTO next_val
  FROM agent_profiles
  WHERE aac_id ~ '^AAC-[0-9]+$';
  
  RETURN 'AAC-' || LPAD(next_val::TEXT, 4, '0');
END;
$_$;


ALTER FUNCTION public.generate_aac_id() OWNER TO postgres;

--
-- Name: generate_listing_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_listing_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('listing_number_seq');
  RETURN 'L-' || next_num;
END;
$$;


ALTER FUNCTION public.generate_listing_number() OWNER TO postgres;

--
-- Name: get_client_favorites_for_agent(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_client_favorites_for_agent(p_client_id uuid) RETURNS TABLE(id uuid, listing_id uuid, created_at timestamp with time zone, address text, city text, state text, zip_code text, price numeric, bedrooms integer, bathrooms numeric, square_feet integer, property_type text, photos jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Verify caller has an active relationship with this client
  IF NOT EXISTS (
    SELECT 1 FROM public.client_agent_relationships
    WHERE agent_id = auth.uid()
      AND client_id = p_client_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'No active relationship with this client';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.listing_id,
    f.created_at,
    l.address,
    l.city,
    l.state,
    l.zip_code,
    l.price,
    l.bedrooms,
    l.bathrooms,
    l.square_feet,
    l.property_type,
    l.photos
  FROM public.favorites f
  JOIN public.listings l ON l.id = f.listing_id
  WHERE f.user_id = p_client_id
  ORDER BY f.created_at DESC;
END;
$$;


ALTER FUNCTION public.get_client_favorites_for_agent(p_client_id uuid) OWNER TO postgres;

--
-- Name: get_listing_interest_signals(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_listing_interest_signals(p_agent_id uuid, p_listing_ids uuid[]) RETURNS TABLE(listing_id uuid, saves_count bigint, comments_count bigint, hotsheet_match_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH agent_client_ids AS (
    -- CRM clients belonging to this agent
    SELECT c.id AS client_id
    FROM public.clients c
    WHERE c.agent_id = p_agent_id
  ),
  agent_client_user_ids AS (
    -- Auth user IDs of clients with active relationships to this agent
    SELECT car.client_id AS user_id
    FROM public.client_agent_relationships car
    WHERE car.agent_id = p_agent_id
      AND car.status = 'active'
  ),
  saves AS (
    SELECT f.listing_id, COUNT(*) AS cnt
    FROM public.favorites f
    WHERE f.listing_id = ANY(p_listing_ids)
      AND f.user_id IN (SELECT user_id FROM agent_client_user_ids)
    GROUP BY f.listing_id
  ),
  comments AS (
    SELECT hsc.listing_id, COUNT(DISTINCT hsc.sender_id) AS cnt
    FROM public.hot_sheet_comments hsc
    JOIN public.hot_sheets hs ON hs.id = hsc.hot_sheet_id
    WHERE hsc.listing_id = ANY(p_listing_ids)
      AND hs.user_id = p_agent_id
      AND hsc.sender_role = 'client'
    GROUP BY hsc.listing_id
  ),
  hs_matches AS (
    SELECT hsl.listing_id, COUNT(DISTINCT hsl.hot_sheet_id) AS cnt
    FROM public.hot_sheet_sent_listings hsl
    JOIN public.hot_sheets hs ON hs.id = hsl.hot_sheet_id
    WHERE hsl.listing_id = ANY(p_listing_ids)
      AND hs.user_id = p_agent_id
    GROUP BY hsl.listing_id
  ),
  all_listings AS (
    SELECT unnest(p_listing_ids) AS lid
  )
  SELECT
    al.lid AS listing_id,
    COALESCE(s.cnt, 0) AS saves_count,
    COALESCE(c.cnt, 0) AS comments_count,
    COALESCE(h.cnt, 0) AS hotsheet_match_count
  FROM all_listings al
  LEFT JOIN saves s ON s.listing_id = al.lid
  LEFT JOIN comments c ON c.listing_id = al.lid
  LEFT JOIN hs_matches h ON h.listing_id = al.lid
  WHERE COALESCE(s.cnt, 0) + COALESCE(c.cnt, 0) + COALESCE(h.cnt, 0) > 0;
$$;


ALTER FUNCTION public.get_listing_interest_signals(p_agent_id uuid, p_listing_ids uuid[]) OWNER TO postgres;

--
-- Name: get_verified_agent_ids(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_verified_agent_ids() RETURNS TABLE(user_id uuid)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT s.user_id
  FROM public.agent_settings s
  WHERE s.agent_status = 'verified'
    AND s.hide_from_directory = false;
$$;


ALTER FUNCTION public.get_verified_agent_ids() OWNER TO postgres;

--
-- Name: get_verified_early_access_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_verified_early_access_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::integer
  FROM public.agent_early_access
  WHERE status = 'verified'
$$;


ALTER FUNCTION public.get_verified_early_access_count() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, email, first_name, last_name, phone)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert into agent_settings
  INSERT INTO public.agent_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_updated_at() OWNER TO postgres;

--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) OWNER TO postgres;

--
-- Name: initialize_listing_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.initialize_listing_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.listing_stats (listing_id)
  VALUES (NEW.id)
  ON CONFLICT (listing_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.initialize_listing_stats() OWNER TO postgres;

--
-- Name: is_buyer_workspace_member(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_buyer_workspace_member(p_workspace_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buyer_workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION public.is_buyer_workspace_member(p_workspace_id uuid) OWNER TO postgres;

--
-- Name: is_buyer_workspace_owner(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_buyer_workspace_owner(p_workspace_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.buyer_workspaces bw
    where bw.id = p_workspace_id
      and bw.owner_id = auth.uid()
  );
$$;


ALTER FUNCTION public.is_buyer_workspace_owner(p_workspace_id uuid) OWNER TO postgres;

--
-- Name: is_feature_enabled(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_feature_enabled(p_flag_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (select enabled from public.feature_flags where flag_name = p_flag_name),
    false
  )
$$;


ALTER FUNCTION public.is_feature_enabled(p_flag_name text) OWNER TO postgres;

--
-- Name: is_team_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND agent_id = p_user_id AND role = 'owner'
  );
$$;


ALTER FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid) OWNER TO postgres;

--
-- Name: is_verified_agent(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_verified_agent() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agent_settings s
    WHERE s.user_id = auth.uid()
      AND s.agent_status = 'verified'
  );
$$;


ALTER FUNCTION public.is_verified_agent() OWNER TO postgres;

--
-- Name: listings_within_radius(double precision, double precision, double precision); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.listings_within_radius(origin_lat double precision, origin_lng double precision, radius_miles double precision) RETURNS TABLE(listing_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT l.id AS listing_id
  FROM public.listings l
  WHERE l.latitude IS NOT NULL
    AND l.longitude IS NOT NULL
    AND (
      3959 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(origin_lat))
          * cos(radians(l.latitude))
          * cos(radians(l.longitude) - radians(origin_lng))
          + sin(radians(origin_lat))
          * sin(radians(l.latitude))
        ))
      )
    ) <= radius_miles;
$$;


ALTER FUNCTION public.listings_within_radius(origin_lat double precision, origin_lng double precision, radius_miles double precision) OWNER TO postgres;

--
-- Name: log_client_need_view(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_client_need_view() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only log when an agent (not the submitter) views a client need
  IF auth.uid() IS NOT NULL AND auth.uid() != NEW.submitted_by THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (auth.uid(), 'VIEW_CLIENT_NEED', 'client_needs', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.log_client_need_view() OWNER TO postgres;

--
-- Name: log_county_preference_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_county_preference_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (auth.uid(), 'ADD_COUNTY_PREFERENCE', 'agent_county_preferences', NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (auth.uid(), 'REMOVE_COUNTY_PREFERENCE', 'agent_county_preferences', OLD.id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.log_county_preference_change() OWNER TO postgres;

--
-- Name: log_listing_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_listing_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (auth.uid(), 'UPDATE_LISTING', 'listings', NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (auth.uid(), 'DELETE_LISTING', 'listings', OLD.id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.log_listing_change() OWNER TO postgres;

--
-- Name: log_listing_status_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_listing_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.log_listing_status_change() OWNER TO postgres;

--
-- Name: log_profile_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_profile_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
  VALUES (auth.uid(), 'UPDATE_PROFILE', 'agent_profiles', NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.log_profile_change() OWNER TO postgres;

--
-- Name: normalize_listing_address(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.normalize_listing_address() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.address_normalized := public.normalize_listing_address_text(NEW.address);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.normalize_listing_address() OWNER TO postgres;

--
-- Name: normalize_listing_address_text(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.normalize_listing_address_text(input text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result text;
BEGIN
  IF input IS NULL OR trim(input) = '' THEN
    RETURN NULL;
  END IF;

  result := lower(trim(input));
  result := regexp_replace(result, '[.,;]', '', 'g');
  result := regexp_replace(result, '\s+', ' ', 'g');
  result := trim(result);

  -- Street suffixes (word-boundary aware)
  result := regexp_replace(result, '\ystreet\y',    'st',   'g');
  result := regexp_replace(result, '\yavenue\y',    'ave',  'g');
  result := regexp_replace(result, '\yroad\y',      'rd',   'g');
  result := regexp_replace(result, '\yboulevard\y', 'blvd', 'g');
  result := regexp_replace(result, '\ylane\y',      'ln',   'g');
  result := regexp_replace(result, '\ydrive\y',     'dr',   'g');
  result := regexp_replace(result, '\ycourt\y',     'ct',   'g');
  result := regexp_replace(result, '\yplace\y',     'pl',   'g');
  result := regexp_replace(result, '\yterrace\y',   'ter',  'g');
  result := regexp_replace(result, '\yparkway\y',   'pkwy', 'g');
  result := regexp_replace(result, '\ycircle\y',    'cir',  'g');
  result := regexp_replace(result, '\yhighway\y',   'hwy',  'g');

  -- Unit markers
  result := regexp_replace(result, '\yapartment\y', 'unit', 'g');
  result := regexp_replace(result, '\yapt\y',       'unit', 'g');
  result := regexp_replace(result, '\ysuite\y',     'unit', 'g');
  result := regexp_replace(result, '\yste\y',       'unit', 'g');
  result := regexp_replace(result, '#(\s*)', 'unit ', 'g');

  -- Final cleanup
  result := regexp_replace(result, '\s+', ' ', 'g');
  result := trim(result);

  RETURN result;
END;
$$;


ALTER FUNCTION public.normalize_listing_address_text(input text) OWNER TO postgres;

--
-- Name: notify_agents_of_client_need(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_agents_of_client_need() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  -- Trigger edge function to send notifications
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-agents-client-need',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'client_need_id', NEW.id,
      'state', NEW.state,
      'city', NEW.city,
      'property_type', NEW.property_type,
      'max_price', NEW.max_price,
      'bedrooms', NEW.bedrooms,
      'bathrooms', NEW.bathrooms,
      'description', NEW.description
    )
  ) INTO request_id;
  
  RAISE LOG 'Triggered client need notification for % with request_id %', NEW.id, request_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger client need notification for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_agents_of_client_need() OWNER TO postgres;

--
-- Name: notify_matching_buyers_on_new_listing(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_matching_buyers_on_new_listing() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('active', 'back_on_market') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
      RETURN NEW;
    END IF;
    IF NEW.status NOT IN ('active', 'back_on_market') THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-matching-buyers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'listing_id', NEW.id::text,
      'address', NEW.address,
      'city', NEW.city,
      'state', NEW.state,
      'price', NEW.price,
      'property_type', NEW.property_type,
      'bedrooms', NEW.bedrooms,
      'bathrooms', NEW.bathrooms,
      'square_feet', NEW.square_feet
    )
  ) INTO request_id;

  RAISE LOG 'Triggered buyer notification for listing % (status: %) with request_id %', NEW.id, NEW.status, request_id;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger buyer notification for listing %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_matching_buyers_on_new_listing() OWNER TO postgres;

--
-- Name: on_hot_sheet_comment_inserted(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.on_hot_sheet_comment_inserted() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_origin text := 'https://allagentconnect.lovable.app';

  v_agent_id uuid;
  v_hot_sheet_name text;
  v_listing_address text;

  -- client -> agent
  v_client_name text;
  v_agent_email text;
  v_agent_first text;
  v_last_seen timestamptz;
  v_recent_agent_email_exists boolean;

  -- agent -> clients
  r_client record;
  v_replying_agent_first text;
  v_recent_client_email_exists boolean;

  -- deeplinks
  v_agent_conversation_url text;
  v_client_conversation_url text;

  -- token lookup per client
  v_share_token text;
begin
  ---------------------------------------------------------------------------
  -- Resolve hot sheet owner + name
  ---------------------------------------------------------------------------
  select hs.user_id, hs.name
    into v_agent_id, v_hot_sheet_name
  from public.hot_sheets hs
  where hs.id = new.hot_sheet_id;

  if v_agent_id is null then
    return new;
  end if;

  ---------------------------------------------------------------------------
  -- Listing address (safe fallback)
  ---------------------------------------------------------------------------
  select l.address
    into v_listing_address
  from public.listings l
  where l.id = new.listing_id;

  v_listing_address := coalesce(nullif(v_listing_address, ''), 'a listing');

  ---------------------------------------------------------------------------
  -- Agent deep link
  ---------------------------------------------------------------------------
  v_agent_conversation_url :=
    v_origin || '/hot-sheets/' || new.hot_sheet_id::text || '/review?listing=' || new.listing_id::text;

  ---------------------------------------------------------------------------
  -- BRANCH A: sender_role = 'client'  (keep behavior, add deep link)
  ---------------------------------------------------------------------------
  if new.sender_role = 'client' then

    select nullif(trim(p.first_name || ' ' || p.last_name), '')
      into v_client_name
    from public.profiles p
    where p.id = new.sender_id;

    v_client_name := coalesce(v_client_name, 'A client');

    -- Always create in-app notification for agent
    insert into public.agent_notifications (agent_id, type, title, body, metadata)
    values (
      v_agent_id,
      'hot_sheet_comment',
      'New comment on ' || v_listing_address,
      v_client_name || ' commented: ' || left(coalesce(new.comment, ''), 120),
      jsonb_build_object(
        'hot_sheet_id', new.hot_sheet_id,
        'listing_id', new.listing_id,
        'comment_id', new.id
      )
    );

    -- If agent is online (last_seen within 5 minutes), skip email
    select s.last_seen_at
      into v_last_seen
    from public.agent_settings s
    where s.user_id = v_agent_id;

    if v_last_seen is not null and v_last_seen > now() - interval '5 minutes' then
      return new;
    end if;

    -- Debounce agent email: 10 minutes per hot_sheet + agent
    select exists (
      select 1
      from public.email_jobs
      where status in ('queued', 'processing', 'sent')
        and created_at > now() - interval '10 minutes'
        and payload->>'template' = 'hot-sheet-comment'
        and payload->'variables'->>'hot_sheet_id' = new.hot_sheet_id::text
        and payload->'variables'->>'agent_id' = v_agent_id::text
    )
    into v_recent_agent_email_exists;

    if v_recent_agent_email_exists then
      return new;
    end if;

    -- Agent email + first name
    select ap.email, ap.first_name
      into v_agent_email, v_agent_first
    from public.agent_profiles ap
    where ap.id = v_agent_id;

    if v_agent_email is null or v_agent_email = '' then
      return new;
    end if;

    v_agent_first := coalesce(nullif(v_agent_first, ''), 'Agent');

    -- Enqueue agent email (with deep link)
    insert into public.email_jobs (payload)
    values (jsonb_build_object(
      'provider', 'resend',
      'template', 'hot-sheet-comment',
      'to', v_agent_email,
      'subject',
        'New comment on your Hot Sheet "' || coalesce(nullif(v_hot_sheet_name, ''), 'Untitled') || '"',
      'variables', jsonb_build_object(
        'agentName', v_agent_first,
        'clientName', v_client_name,
        'hotSheetName', coalesce(nullif(v_hot_sheet_name, ''), 'Untitled'),
        'listingAddress', v_listing_address,
        'commentPreview', left(coalesce(new.comment, ''), 200),
        'conversationUrl', v_agent_conversation_url,
        'hot_sheet_id', new.hot_sheet_id::text,
        'agent_id', v_agent_id::text,
        'listing_id', new.listing_id::text,
        'comment_id', new.id::text
      )
    ));

    return new;
  end if;

  ---------------------------------------------------------------------------
  -- BRANCH B: sender_role = 'agent'  (notify ALL clients with their OWN token)
  ---------------------------------------------------------------------------
  if new.sender_role = 'agent' then

    select ap.first_name
      into v_replying_agent_first
    from public.agent_profiles ap
    where ap.id = new.sender_id;

    v_replying_agent_first := coalesce(nullif(v_replying_agent_first, ''), 'Your agent');

    for r_client in
      select c.id as client_id,
             c.email as client_email,
             c.first_name as client_first_name
      from public.hot_sheet_clients hsc
      join public.clients c on c.id = hsc.client_id
      where hsc.hot_sheet_id = new.hot_sheet_id
        and c.email is not null
        and c.email <> ''
    loop
      -- Find the token for THIS client + THIS hot sheet
      v_share_token := null;

      select st.token
        into v_share_token
      from public.share_tokens st
      where (st.payload->>'type') = 'client_hotsheet_invite'
        and (st.payload->>'hot_sheet_id') = new.hot_sheet_id::text
        and (
          (st.payload ? 'client_id' and nullif(st.payload->>'client_id','') is not null and st.payload->>'client_id' = r_client.client_id::text)
          or
          ( (not (st.payload ? 'client_id') or nullif(st.payload->>'client_id','') is null)
            and (st.payload ? 'client_email')
            and lower(st.payload->>'client_email') = lower(r_client.client_email)
          )
        )
      order by st.created_at desc
      limit 1;

      -- Safety: no token = no email (no leaking someone else's token)
      if v_share_token is null or v_share_token = '' then
        continue;
      end if;

      v_client_conversation_url :=
        v_origin || '/client/hotsheet/' || v_share_token || '?listing=' || new.listing_id::text;

      -- Debounce per hot_sheet + client + listing for 10 minutes
      select exists (
        select 1
        from public.email_jobs
        where status in ('queued', 'processing', 'sent')
          and created_at > now() - interval '10 minutes'
          and payload->>'template' = 'hot-sheet-agent-reply'
          and payload->'variables'->>'hot_sheet_id' = new.hot_sheet_id::text
          and payload->'variables'->>'client_id' = r_client.client_id::text
          and payload->'variables'->>'listing_id' = new.listing_id::text
      )
      into v_recent_client_email_exists;

      if v_recent_client_email_exists then
        continue;
      end if;

      insert into public.email_jobs (payload)
      values (jsonb_build_object(
        'provider', 'resend',
        'template', 'hot-sheet-agent-reply',
        'to', r_client.client_email,
        'subject',
          v_replying_agent_first || ' posted an update in "' || coalesce(nullif(v_hot_sheet_name, ''), 'Untitled') || '"',
        'variables', jsonb_build_object(
          'clientName', coalesce(nullif(r_client.client_first_name, ''), 'there'),
          'agentName', v_replying_agent_first,
          'hotSheetName', coalesce(nullif(v_hot_sheet_name, ''), 'Untitled'),
          'listingAddress', v_listing_address,
          'commentPreview', left(coalesce(new.comment, ''), 200),
          'conversationUrl', v_client_conversation_url,
          'shareToken', v_share_token,
          'hot_sheet_id', new.hot_sheet_id::text,
          'client_id', r_client.client_id::text,
          'agent_id', new.sender_id::text,
          'listing_id', new.listing_id::text,
          'comment_id', new.id::text
        )
      ));
    end loop;

    return new;
  end if;

  return new;
end;
$$;


ALTER FUNCTION public.on_hot_sheet_comment_inserted() OWNER TO postgres;

--
-- Name: owns_submission(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.owns_submission(p_submission_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.agent_match_submissions 
    WHERE id = p_submission_id 
    AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION public.owns_submission(p_submission_id uuid) OWNER TO postgres;

--
-- Name: prevent_bwi_acceptance_overwrite(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_bwi_acceptance_overwrite() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF old.accepted_by_user_id IS NOT NULL THEN
    IF new.accepted_by_user_id IS DISTINCT FROM old.accepted_by_user_id
       OR new.accepted_at IS DISTINCT FROM old.accepted_at THEN
      RAISE EXCEPTION 'buyer_workspace_invites acceptance is immutable once accepted';
    END IF;
  END IF;
  RETURN new;
END;
$$;


ALTER FUNCTION public.prevent_bwi_acceptance_overwrite() OWNER TO postgres;

--
-- Name: rate_limit_consume(text, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rate_limit_consume(p_key text, p_window_seconds integer, p_limit integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_window_start timestamptz;
  v_current_count int;
  v_reset_at timestamptz;
  v_allowed boolean;
  v_remaining int;
BEGIN
  -- Calculate current window start (truncate to window boundary)
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + (p_window_seconds || ' seconds')::interval;

  -- Atomic upsert: increment count or insert new record
  INSERT INTO public.rate_limits (key, window_start, count, updated_at)
  VALUES (p_key, v_window_start, 1, now())
  ON CONFLICT (key, window_start)
  DO UPDATE SET
    count = public.rate_limits.count + 1,
    updated_at = now()
  RETURNING count INTO v_current_count;

  -- Determine if request is allowed
  v_allowed := v_current_count <= p_limit;
  v_remaining := GREATEST(0, p_limit - v_current_count);

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'reset_at', v_reset_at,
    'current_count', v_current_count
  );
END;
$$;


ALTER FUNCTION public.rate_limit_consume(p_key text, p_window_seconds integer, p_limit integer) OWNER TO postgres;

--
-- Name: rate_limits_cleanup(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rate_limits_cleanup() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE updated_at < now() - interval '1 hour';
END;
$$;


ALTER FUNCTION public.rate_limits_cleanup() OWNER TO postgres;

--
-- Name: resolve_user_role(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.resolve_user_role(_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin  boolean;
  v_is_agent  boolean;
  v_is_buyer  boolean;
  v_verified  boolean;
BEGIN
  -- Self-only guard for authenticated callers.
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RETURN jsonb_build_object('role', 'unknown', 'is_verified_agent', false);
  END IF;

  -- Priority 1: admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN jsonb_build_object('role', 'admin', 'is_verified_agent', false);
  END IF;

  -- Priority 2: agent (agent wins over buyer for dual-role users)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'agent'
  ) INTO v_is_agent;

  IF v_is_agent THEN
    SELECT EXISTS (
      SELECT 1 FROM public.agent_settings
      WHERE user_id = _user_id AND agent_status = 'verified'
    ) INTO v_verified;

    RETURN jsonb_build_object('role', 'agent', 'is_verified_agent', COALESCE(v_verified, false));
  END IF;

  -- Priority 3: buyer
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'buyer'
  ) INTO v_is_buyer;

  IF v_is_buyer THEN
    RETURN jsonb_build_object('role', 'buyer', 'is_verified_agent', false);
  END IF;

  -- Fallback: no role assigned
  RETURN jsonb_build_object('role', 'unknown', 'is_verified_agent', false);
END;
$$;


ALTER FUNCTION public.resolve_user_role(_user_id uuid) OWNER TO postgres;

--
-- Name: set_aac_id_on_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_aac_id_on_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.aac_id IS NULL OR NEW.aac_id = '' THEN
    NEW.aac_id := public.generate_aac_id();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_aac_id_on_insert() OWNER TO postgres;

--
-- Name: set_agent_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_agent_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;


ALTER FUNCTION public.set_agent_settings_updated_at() OWNER TO postgres;

--
-- Name: set_cancelled_date(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_cancelled_date() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Set cancelled_at when status changes to cancelled, withdrawn, or temporarily_withdrawn
  IF NEW.status IN ('cancelled', 'withdrawn', 'temporarily_withdrawn') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('cancelled', 'withdrawn', 'temporarily_withdrawn')) THEN
    NEW.cancelled_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_cancelled_date() OWNER TO postgres;

--
-- Name: set_listing_active_date(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_listing_active_date() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- If status is being changed to active and active_date is not yet set
  IF NEW.status = 'active' AND OLD.status != 'active' AND NEW.active_date IS NULL THEN
    NEW.active_date = now();
  END IF;
  
  -- If status is being changed away from active, keep the active_date
  -- (this preserves the original active date for historical purposes)
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_listing_active_date() OWNER TO postgres;

--
-- Name: sync_hot_sheet_to_client_needs(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_hot_sheet_to_client_needs() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  property_type_val text;
  city_val text;
  state_val text;
  max_price_val numeric;
  bedrooms_val integer;
  bathrooms_val numeric;
  description_val text;
  can_insert boolean := false;
BEGIN
  -- Verify that submitted_by (NEW.user_id) exists in a valid referenced table to avoid FK violations
  -- Check profiles
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.user_id) THEN
    can_insert := true;
  END IF;
  -- Check agent_profiles as well (some setups use agent_profiles.id as FK target)
  IF NOT can_insert AND EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE ap.id = NEW.user_id) THEN
    can_insert := true;
  END IF;

  IF NOT can_insert THEN
    RAISE NOTICE 'Skipping client_needs sync for hot sheet %: no matching profile found for user_id %', NEW.id, NEW.user_id;
    RETURN NEW; -- Do not error; just skip sync
  END IF;

  -- Extract values from criteria JSONB
  property_type_val := COALESCE(
    (NEW.criteria->'propertyTypes'->>0)::text,
    'single_family'
  );
  
  -- Get the first city if cities array exists
  city_val := (NEW.criteria->'cities'->>0)::text;
  
  state_val := (NEW.criteria->>'state')::text;
  
  max_price_val := COALESCE(
    (NEW.criteria->>'maxPrice')::numeric,
    999999999
  );
  
  bedrooms_val := (NEW.criteria->>'bedrooms')::integer;
  bathrooms_val := (NEW.criteria->>'bathrooms')::numeric;
  
  -- Build description from criteria
  description_val := 'Auto-generated from hot sheet: ' || NEW.name;
  
  -- Only create/update if we have minimum required data (state or city)
  IF state_val IS NOT NULL OR city_val IS NOT NULL THEN
    -- Check if a client need already exists for this hot sheet
    IF EXISTS (
      SELECT 1 FROM client_needs 
      WHERE submitted_by = NEW.user_id 
      AND description LIKE '%hot sheet: ' || NEW.name || '%'
    ) THEN
      -- Update existing
      UPDATE client_needs
      SET
        property_type = property_type_val::property_type,
        city = city_val,
        state = state_val,
        max_price = max_price_val,
        bedrooms = bedrooms_val,
        bathrooms = bathrooms_val
      WHERE submitted_by = NEW.user_id
      AND description LIKE '%hot sheet: ' || NEW.name || '%';
    ELSE
      -- Insert new client need
      INSERT INTO client_needs (
        submitted_by,
        property_type,
        city,
        state,
        max_price,
        bedrooms,
        bathrooms,
        description
      ) VALUES (
        NEW.user_id,
        property_type_val::property_type,
        city_val,
        state_val,
        max_price_val,
        bedrooms_val,
        bathrooms_val,
        description_val
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN foreign_key_violation THEN
    -- Avoid failing the hot sheet creation due to FK mismatch; log and continue
    RAISE WARNING 'FK violation when syncing hot sheet % to client_needs for user_id %; skipping. Error: %', NEW.id, NEW.user_id, SQLERRM;
    RETURN NEW;
  WHEN OTHERS THEN
    RAISE WARNING 'Unexpected error syncing hot sheet % to client_needs: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_hot_sheet_to_client_needs() OWNER TO postgres;

--
-- Name: track_favorite_price_changes(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.track_favorite_price_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only track if price actually changed
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    -- Insert price change record for all favorites of this listing
    INSERT INTO public.favorite_price_history (favorite_id, listing_id, old_price, new_price)
    SELECT 
      f.id,
      NEW.id,
      OLD.price,
      NEW.price
    FROM public.favorites f
    WHERE f.listing_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.track_favorite_price_changes() OWNER TO postgres;

--
-- Name: trigger_property_data_fetch(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_property_data_fetch() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  -- Only trigger if the listing has an address (Google Places provides full address)
  IF NEW.address IS NOT NULL AND NEW.address != '' THEN
    -- Use pg_net to make async HTTP request to edge function
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/auto-fetch-property-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', current_setting('supabase.service_role_key', true)
      ),
      body := jsonb_build_object('listing_id', NEW.id::text)
    ) INTO request_id;
    
    RAISE LOG 'Triggered property data fetch for listing % with request_id %', NEW.id, request_id;
  ELSE
    RAISE LOG 'Skipped property data fetch for listing % - no address', NEW.id;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert/update
    RAISE WARNING 'Failed to trigger property data fetch for listing %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_property_data_fetch() OWNER TO postgres;

--
-- Name: FUNCTION trigger_property_data_fetch(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.trigger_property_data_fetch() IS 'Automatically calls edge function to fetch property data from ATTOM API when a listing is created or address is updated. Handles Google Places full addresses.';


--
-- Name: update_conversation_last_message_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_conversation_last_message_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_conversation_last_message_at() OWNER TO postgres;

--
-- Name: update_conversation_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_conversation_timestamp() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_conversation_timestamp() OWNER TO postgres;

--
-- Name: update_cumulative_active_days(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_cumulative_active_days() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  total_days integer := 0;
  active_start timestamp with time zone;
  history_record RECORD;
BEGIN
  -- Only recalculate if status changed
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Calculate cumulative active days from status history
  FOR history_record IN 
    SELECT new_status, changed_at
    FROM public.listing_status_history
    WHERE listing_id = NEW.id
    ORDER BY changed_at ASC
  LOOP
    IF history_record.new_status = 'active' AND active_start IS NULL THEN
      -- Start of active period
      active_start := history_record.changed_at;
    ELSIF history_record.new_status != 'active' AND active_start IS NOT NULL THEN
      -- End of active period
      total_days := total_days + CEIL(EXTRACT(EPOCH FROM (history_record.changed_at - active_start)) / 86400);
      active_start := NULL;
    END IF;
  END LOOP;

  -- If currently active, add days from last active start to now
  IF active_start IS NOT NULL THEN
    total_days := total_days + CEIL(EXTRACT(EPOCH FROM (now() - active_start)) / 86400);
  END IF;

  -- Update listing_stats
  UPDATE public.listing_stats
  SET cumulative_active_days = total_days,
      updated_at = now()
  WHERE listing_id = NEW.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_cumulative_active_days() OWNER TO postgres;

--
-- Name: update_hot_sheet_listing_status_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_hot_sheet_listing_status_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_hot_sheet_listing_status_updated_at() OWNER TO postgres;

--
-- Name: update_listing_contact_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_listing_contact_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.listing_stats
  SET contact_count = contact_count + 1,
      updated_at = now()
  WHERE listing_id = NEW.listing_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_listing_contact_count() OWNER TO postgres;

--
-- Name: update_listing_save_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_listing_save_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.listing_stats
    SET save_count = save_count + 1,
        updated_at = now()
    WHERE listing_id = NEW.listing_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.listing_stats
    SET save_count = GREATEST(save_count - 1, 0),
        updated_at = now()
    WHERE listing_id = OLD.listing_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.update_listing_save_count() OWNER TO postgres;

--
-- Name: update_listing_share_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_listing_share_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO listing_stats (listing_id, share_count)
  VALUES (NEW.listing_id, 1)
  ON CONFLICT (listing_id)
  DO UPDATE SET 
    share_count = listing_stats.share_count + 1,
    updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_listing_share_count() OWNER TO postgres;

--
-- Name: update_listing_showing_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_listing_showing_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.listing_stats
  SET showing_request_count = showing_request_count + 1,
      updated_at = now()
  WHERE listing_id = NEW.listing_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_listing_showing_count() OWNER TO postgres;

--
-- Name: update_listing_view_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_listing_view_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.listing_stats
  SET view_count = view_count + 1,
      updated_at = now()
  WHERE listing_id = NEW.listing_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_listing_view_count() OWNER TO postgres;

--
-- Name: update_seller_match_latest_outcome(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_seller_match_latest_outcome() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.seller_matches sm
  SET
    latest_outcome       = NEW.outcome,          -- enum
    latest_outcome_at    = NEW.created_at,
    latest_outcome_id    = NEW.id,
    latest_outcome_notes = NEW.notes,
    next_followup_at     = COALESCE(NEW.next_followup_at, sm.next_followup_at),
    updated_at           = now()
  WHERE sm.id = NEW.match_id;

  RETURN NEW;
END $$;


ALTER FUNCTION public.update_seller_match_latest_outcome() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: update_vendor_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_vendor_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_vendor_updated_at() OWNER TO postgres;

--
-- Name: aac_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.aac_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.aac_id_seq OWNER TO postgres;

--
-- Name: ad_clicks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ad_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ad_id uuid NOT NULL,
    impression_id uuid,
    viewer_ip text,
    viewer_id uuid,
    page_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ad_clicks OWNER TO postgres;

--
-- Name: ad_impressions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ad_impressions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ad_id uuid NOT NULL,
    viewer_ip text,
    viewer_id uuid,
    page_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ad_impressions OWNER TO postgres;

--
-- Name: ad_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ad_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    price numeric NOT NULL,
    duration_days integer NOT NULL,
    ad_type text NOT NULL,
    features jsonb DEFAULT '[]'::jsonb,
    max_impressions integer,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ad_packages OWNER TO postgres;

--
-- Name: advertisements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.advertisements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    ad_type text NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    link_url text NOT NULL,
    placement_zone text,
    target_locations jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.advertisements OWNER TO postgres;

--
-- Name: agent_buyer_coverage_areas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_buyer_coverage_areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    zip_code text NOT NULL,
    city text,
    state text,
    created_at timestamp with time zone DEFAULT now(),
    neighborhood text,
    county text,
    source text DEFAULT 'profile'::text NOT NULL
);


ALTER TABLE public.agent_buyer_coverage_areas OWNER TO postgres;

--
-- Name: agent_county_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_county_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    county_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.agent_county_preferences OWNER TO postgres;

--
-- Name: agent_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_settings (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    onboarding_started boolean DEFAULT false NOT NULL,
    onboarding_completed boolean DEFAULT false NOT NULL,
    preferences_set boolean DEFAULT false NOT NULL,
    notifications_set boolean DEFAULT false NOT NULL,
    price_min integer,
    price_max integer,
    price_no_min boolean DEFAULT false NOT NULL,
    price_no_max boolean DEFAULT false NOT NULL,
    property_types text[] DEFAULT '{}'::text[] NOT NULL,
    state text,
    county text,
    towns text[] DEFAULT '{}'::text[] NOT NULL,
    email_frequency text DEFAULT 'immediate'::text NOT NULL,
    notifications_enabled boolean DEFAULT true NOT NULL,
    muted_all boolean DEFAULT false NOT NULL,
    tour_completed boolean DEFAULT false NOT NULL,
    welcome_modal_dismissed boolean DEFAULT false NOT NULL,
    agent_status public.agent_status DEFAULT 'pending'::public.agent_status NOT NULL,
    license_state text,
    license_number text,
    license_last_name text,
    verification_method text,
    verified_at timestamp with time zone,
    last_verification_attempt_at timestamp with time zone,
    verification_attempt_count integer DEFAULT 0 NOT NULL,
    verification_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    approval_email_sent boolean DEFAULT false NOT NULL,
    early_access boolean DEFAULT false NOT NULL,
    hide_from_directory boolean DEFAULT false NOT NULL,
    show_buyer_proposal boolean DEFAULT false NOT NULL,
    show_seller_proposal boolean DEFAULT false NOT NULL,
    last_seen_at timestamp with time zone
);


ALTER TABLE public.agent_settings OWNER TO postgres;

--
-- Name: agent_directory_status; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.agent_directory_status WITH (security_invoker='false') AS
 SELECT user_id,
    agent_status
   FROM public.agent_settings
  WHERE (agent_status = 'verified'::public.agent_status);


ALTER VIEW public.agent_directory_status OWNER TO postgres;

--
-- Name: VIEW agent_directory_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.agent_directory_status IS 'Public view exposing only verified agent IDs for directory pages. Does not expose other agent_settings columns.';


--
-- Name: agent_early_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_early_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    brokerage text NOT NULL,
    state text NOT NULL,
    license_number text NOT NULL,
    markets text,
    specialties text[],
    status text DEFAULT 'pending'::text NOT NULL,
    verified_at timestamp with time zone,
    verified_by uuid,
    founding_partner boolean DEFAULT false NOT NULL,
    notes text,
    listing_id uuid,
    source text,
    registered_from_listing boolean DEFAULT false NOT NULL,
    CONSTRAINT agent_early_access_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])))
);


ALTER TABLE public.agent_early_access OWNER TO postgres;

--
-- Name: COLUMN agent_early_access.listing_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.agent_early_access.listing_id IS 'The listing UUID that drove this registration (if any)';


--
-- Name: COLUMN agent_early_access.source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.agent_early_access.source IS 'Traffic source: social, email, facebook, linkedin, sms, etc.';


--
-- Name: COLUMN agent_early_access.registered_from_listing; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.agent_early_access.registered_from_listing IS 'True if registration was driven by a listing share link';


--
-- Name: agent_invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inviter_user_id uuid NOT NULL,
    invitee_email text NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    accepted_user_id uuid,
    CONSTRAINT agent_invites_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'accepted'::text, 'expired'::text])))
);


ALTER TABLE public.agent_invites OWNER TO postgres;

--
-- Name: agent_license_uploads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_license_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    status text DEFAULT 'pending_review'::text NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.agent_license_uploads OWNER TO postgres;

--
-- Name: agent_match_deliveries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_match_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    hot_sheet_id uuid,
    viewed_at timestamp with time zone,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notified_agent_at timestamp with time zone
);


ALTER TABLE public.agent_match_deliveries OWNER TO postgres;

--
-- Name: agent_match_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_match_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    seller_email text NOT NULL,
    seller_name text,
    seller_phone text,
    address text NOT NULL,
    unit_number text,
    city text NOT NULL,
    state text NOT NULL,
    zip_code text,
    neighborhood text,
    property_type text NOT NULL,
    bedrooms integer NOT NULL,
    bathrooms numeric(3,1) NOT NULL,
    square_feet integer NOT NULL,
    asking_price numeric(12,2) NOT NULL,
    lot_size numeric(10,2),
    year_built integer,
    description text,
    photos text[] DEFAULT '{}'::text[],
    floor_plan_urls text[] DEFAULT '{}'::text[],
    video_url text,
    property_website_url text,
    buyer_agent_commission text,
    confirmed_not_under_contract boolean DEFAULT false NOT NULL,
    confirmed_owner_or_authorized boolean DEFAULT false NOT NULL,
    match_count integer,
    matched_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    delivery_fee_cents integer DEFAULT 2999,
    payment_completed_at timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    preferred_contact_method text DEFAULT 'email'::text NOT NULL,
    seller_verification_consent boolean DEFAULT false NOT NULL,
    receive_listing_proposals boolean DEFAULT false NOT NULL,
    CONSTRAINT check_preferred_contact_method CHECK ((preferred_contact_method = ANY (ARRAY['email'::text, 'text'::text, 'phone'::text])))
);


ALTER TABLE public.agent_match_submissions OWNER TO postgres;

--
-- Name: agent_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    sender_name text NOT NULL,
    sender_email text NOT NULL,
    sender_phone text,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.agent_messages OWNER TO postgres;

--
-- Name: agent_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    metadata jsonb DEFAULT '{}'::jsonb,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.agent_notifications OWNER TO postgres;

--
-- Name: agent_presence; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.agent_presence WITH (security_invoker='false') AS
 SELECT user_id,
    last_seen_at
   FROM public.agent_settings;


ALTER VIEW public.agent_presence OWNER TO postgres;

--
-- Name: agent_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text,
    company text,
    receive_buyer_alerts boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    bio text,
    social_links jsonb DEFAULT '{"twitter": "", "website": "", "facebook": "", "linkedin": "", "instagram": ""}'::jsonb,
    buyer_incentives text,
    seller_incentives text,
    aac_id text DEFAULT public.generate_aac_id() NOT NULL,
    headshot_url text,
    logo_url text,
    office_phone text,
    cell_phone text,
    office_name text,
    office_address text,
    title text,
    office_city text,
    office_state text,
    office_zip text,
    header_background_type text DEFAULT 'gradient'::text,
    header_background_value text DEFAULT 'blue-indigo'::text,
    header_image_url text,
    team_name text
);


ALTER TABLE public.agent_profiles OWNER TO postgres;

--
-- Name: COLUMN agent_profiles.header_background_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.agent_profiles.header_background_type IS 'Type of header background: image, gradient, or pattern';


--
-- Name: COLUMN agent_profiles.header_background_value; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.agent_profiles.header_background_value IS 'Value for gradient or pattern name';


--
-- Name: COLUMN agent_profiles.header_image_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.agent_profiles.header_image_url IS 'URL for uploaded header image';


--
-- Name: agent_proposal_incentives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_proposal_incentives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    buyer_fee_credit_type text,
    buyer_fee_credit_value numeric(10,2),
    listing_commission_type text,
    listing_commission_value numeric(10,2),
    flat_fee_option boolean DEFAULT false NOT NULL,
    flat_fee_amount numeric(12,2),
    custom_incentive_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_proposal_incentives_buyer_fee_credit_type_check CHECK ((buyer_fee_credit_type = ANY (ARRAY['percentage'::text, 'flat'::text]))),
    CONSTRAINT agent_proposal_incentives_listing_commission_type_check CHECK ((listing_commission_type = ANY (ARRAY['percentage'::text, 'flat'::text, 'hybrid'::text])))
);


ALTER TABLE public.agent_proposal_incentives OWNER TO postgres;

--
-- Name: agent_state_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_state_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    state text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.agent_state_preferences OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: buyer_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.buyer_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_type text NOT NULL,
    document_url text NOT NULL,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    verified_at timestamp with time zone,
    verified_by uuid,
    expires_at date,
    approval_amount numeric,
    lender_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT buyer_credentials_credential_type_check CHECK ((credential_type = ANY (ARRAY['prequalified'::text, 'preapproved'::text]))),
    CONSTRAINT buyer_credentials_verification_status_check CHECK ((verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])))
);


ALTER TABLE public.buyer_credentials OWNER TO postgres;

--
-- Name: buyer_qualifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.buyer_qualifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    qualification_method text,
    pre_approval_uploaded boolean DEFAULT false NOT NULL,
    pre_approval_file_path text,
    proof_of_funds_uploaded boolean DEFAULT false NOT NULL,
    proof_of_funds_file_path text,
    documentation_agreed boolean DEFAULT false NOT NULL,
    documentation_agreed_at timestamp with time zone,
    receive_agent_proposals boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT buyer_qualifications_qualification_method_check CHECK ((qualification_method = ANY (ARRAY['pre_approval'::text, 'proof_of_funds'::text, 'documentation_agreement'::text])))
);


ALTER TABLE public.buyer_qualifications OWNER TO postgres;

--
-- Name: buyer_workspace_invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.buyer_workspace_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    workspace_id uuid NOT NULL,
    agent_id uuid,
    created_by_user_id uuid NOT NULL,
    buyer_email text NOT NULL,
    buyer_first_name text,
    buyer_last_name text,
    buyer_user_id uuid,
    accepted_at timestamp with time zone,
    accepted_by_user_id uuid,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_resent_at timestamp with time zone,
    CONSTRAINT buyer_workspace_invites_acceptance_chk CHECK ((((accepted_at IS NULL) AND (accepted_by_user_id IS NULL)) OR ((accepted_at IS NOT NULL) AND (accepted_by_user_id IS NOT NULL))))
);


ALTER TABLE public.buyer_workspace_invites OWNER TO postgres;

--
-- Name: buyer_workspace_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.buyer_workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.buyer_workspace_members OWNER TO postgres;

--
-- Name: buyer_workspaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.buyer_workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.buyer_workspaces OWNER TO postgres;

--
-- Name: client_agent_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_agent_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    sender_user_id uuid NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email_job_id uuid
);


ALTER TABLE public.client_agent_messages OWNER TO postgres;

--
-- Name: client_agent_relationships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_agent_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    invitation_token text,
    created_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'active'::text NOT NULL,
    ended_at timestamp with time zone,
    crm_client_id uuid,
    CONSTRAINT valid_relationship_status CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'declined'::text, 'inactive'::text])))
);


ALTER TABLE public.client_agent_relationships OWNER TO postgres;

--
-- Name: client_needs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.client_needs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submitted_by uuid NOT NULL,
    property_type public.property_type NOT NULL,
    county_id uuid,
    max_price numeric(12,2) NOT NULL,
    bedrooms integer,
    bathrooms numeric(3,1),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    city text,
    state text,
    property_types public.property_type[]
);

ALTER TABLE ONLY public.client_needs REPLICA IDENTITY FULL;


ALTER TABLE public.client_needs OWNER TO postgres;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_type text,
    is_favorite boolean DEFAULT false NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    agent_user_id uuid,
    CONSTRAINT client_type_check CHECK (((client_type IS NULL) OR (client_type = ANY (ARRAY['buyer'::text, 'seller'::text, 'renter'::text, 'agent'::text, 'lender'::text, 'attorney'::text, 'inspector'::text, 'other'::text]))))
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: clients_with_relationship_status; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.clients_with_relationship_status WITH (security_invoker='on') AS
 SELECT c.id,
    c.agent_id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.notes,
    c.created_at,
    c.updated_at,
    c.client_type,
    c.is_favorite,
    r.ended_at AS relationship_ended_at,
    r.created_at AS relationship_created_at,
    r.client_id AS relationship_user_id,
        CASE
            WHEN (r.id IS NULL) THEN 'none'::text
            WHEN (r.ended_at IS NULL) THEN 'active'::text
            ELSE 'ended'::text
        END AS relationship_status
   FROM (public.clients c
     LEFT JOIN LATERAL ( SELECT r_1.id,
            r_1.client_id,
            r_1.agent_id,
            r_1.invitation_token,
            r_1.created_at,
            r_1.status,
            r_1.ended_at,
            r_1.crm_client_id
           FROM public.client_agent_relationships r_1
          WHERE ((r_1.crm_client_id = c.id) AND (r_1.agent_id = c.agent_id))
          ORDER BY r_1.created_at DESC
         LIMIT 1) r ON (true));


ALTER VIEW public.clients_with_relationship_status OWNER TO postgres;

--
-- Name: coming_soon_signups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coming_soon_signups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.coming_soon_signups OWNER TO postgres;

--
-- Name: conversation_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_agent_id uuid NOT NULL,
    recipient_agent_id uuid NOT NULL,
    subject text,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone
);


ALTER TABLE public.conversation_messages OWNER TO postgres;

--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_participants (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    is_muted boolean DEFAULT false NOT NULL
);


ALTER TABLE public.conversation_participants OWNER TO postgres;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_a_id uuid NOT NULL,
    agent_b_id uuid NOT NULL,
    listing_id uuid,
    buyer_need_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: conversation_inbox; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.conversation_inbox AS
 SELECT c.id AS conversation_id,
    c.last_message_at,
    cp.last_read_at,
    lm.body AS last_message_preview,
    lm.sender_agent_id AS last_message_sender_id,
    ((c.last_message_at > COALESCE(cp.last_read_at, '1970-01-01 00:00:00+00'::timestamp with time zone)) AND (lm.sender_agent_id IS DISTINCT FROM cp.user_id)) AS is_unread,
    COALESCE(uc.cnt, 0) AS unread_count,
        CASE
            WHEN (c.agent_a_id = cp.user_id) THEN c.agent_b_id
            ELSE c.agent_a_id
        END AS other_user_id,
    c.listing_id,
    c.buyer_need_id
   FROM (((public.conversations c
     JOIN public.conversation_participants cp ON ((cp.conversation_id = c.id)))
     LEFT JOIN LATERAL ( SELECT m.body,
            m.sender_agent_id
           FROM public.conversation_messages m
          WHERE (m.conversation_id = c.id)
          ORDER BY m.created_at DESC
         LIMIT 1) lm ON (true))
     LEFT JOIN LATERAL ( SELECT (count(*))::integer AS cnt
           FROM public.conversation_messages m2
          WHERE ((m2.conversation_id = c.id) AND (m2.sender_agent_id IS DISTINCT FROM cp.user_id) AND (m2.created_at > COALESCE(cp.last_read_at, '1970-01-01 00:00:00+00'::timestamp with time zone)))) uc ON (true))
  WHERE (cp.user_id = auth.uid());


ALTER VIEW public.conversation_inbox OWNER TO postgres;

--
-- Name: counties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.counties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    state text DEFAULT 'MA'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.counties OWNER TO postgres;

--
-- Name: deleted_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deleted_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_user_id uuid NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    phone text,
    company text,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    deletion_reason text,
    original_data jsonb
);


ALTER TABLE public.deleted_users OWNER TO postgres;

--
-- Name: email_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    recipient_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.email_campaigns OWNER TO postgres;

--
-- Name: email_clicks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_send_id uuid NOT NULL,
    clicked_at timestamp with time zone DEFAULT now(),
    url text NOT NULL,
    user_agent text,
    ip_address text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.email_clicks OWNER TO postgres;

--
-- Name: email_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_events (
    id bigint NOT NULL,
    job_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    event text NOT NULL,
    detail jsonb
);


ALTER TABLE public.email_events OWNER TO postgres;

--
-- Name: email_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_events_id_seq OWNER TO postgres;

--
-- Name: email_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.email_events_id_seq OWNED BY public.email_events.id;


--
-- Name: email_opens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_opens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_send_id uuid NOT NULL,
    opened_at timestamp with time zone DEFAULT now(),
    user_agent text,
    ip_address text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.email_opens OWNER TO postgres;

--
-- Name: email_sends; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    recipient_email text NOT NULL,
    recipient_name text NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'sent'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT email_sends_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'bounced'::text])))
);


ALTER TABLE public.email_sends OWNER TO postgres;

--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    category text DEFAULT 'custom'::text NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_templates OWNER TO postgres;

--
-- Name: favorite_price_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.favorite_price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    favorite_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    old_price numeric NOT NULL,
    new_price numeric NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    notification_sent boolean DEFAULT false,
    notification_sent_at timestamp with time zone
);


ALTER TABLE public.favorite_price_history OWNER TO postgres;

--
-- Name: favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.favorites OWNER TO postgres;

--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flag_name text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.feature_flags OWNER TO postgres;

--
-- Name: hot_sheet_clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hot_sheet_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hot_sheet_id uuid NOT NULL,
    client_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.hot_sheet_clients OWNER TO postgres;

--
-- Name: hot_sheet_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hot_sheet_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hot_sheet_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    sender_role text DEFAULT 'client'::text NOT NULL,
    sender_id uuid,
    CONSTRAINT chk_hot_sheet_comment_sender_role CHECK ((sender_role = ANY (ARRAY['agent'::text, 'client'::text])))
);


ALTER TABLE public.hot_sheet_comments OWNER TO postgres;

--
-- Name: hot_sheet_favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hot_sheet_favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hot_sheet_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.hot_sheet_favorites OWNER TO postgres;

--
-- Name: hot_sheet_listing_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hot_sheet_listing_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hot_sheet_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    status text DEFAULT 'unseen'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hot_sheet_listing_status_status_check CHECK ((status = ANY (ARRAY['unseen'::text, 'kept'::text, 'favorited'::text, 'deleted'::text])))
);


ALTER TABLE public.hot_sheet_listing_status OWNER TO postgres;

--
-- Name: hot_sheet_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hot_sheet_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hot_sheet_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    user_id uuid NOT NULL,
    notification_sent boolean DEFAULT false,
    notification_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.hot_sheet_notifications OWNER TO postgres;

--
-- Name: hot_sheet_sent_listings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hot_sheet_sent_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hot_sheet_id uuid NOT NULL,
    listing_id uuid NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    status_at_send text NOT NULL
);


ALTER TABLE public.hot_sheet_sent_listings OWNER TO postgres;

--
-- Name: hot_sheet_shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hot_sheet_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hot_sheet_id uuid NOT NULL,
    shared_with_email text NOT NULL,
    shared_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.hot_sheet_shares OWNER TO postgres;

--
-- Name: hot_sheet_subscribers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hot_sheet_subscribers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hot_sheet_id uuid NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    unsubscribed_at timestamp with time zone,
    unsubscribe_token text DEFAULT encode(extensions.gen_random_bytes(24), 'hex'::text) NOT NULL,
    preview_token text DEFAULT encode(extensions.gen_random_bytes(24), 'hex'::text) NOT NULL,
    CONSTRAINT hot_sheet_subscribers_email_lower CHECK ((email = lower(email)))
);


ALTER TABLE public.hot_sheet_subscribers OWNER TO postgres;

--
-- Name: hot_sheets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hot_sheets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    criteria jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_id uuid,
    notify_client_email boolean DEFAULT false,
    notify_agent_email boolean DEFAULT true,
    notification_schedule text DEFAULT 'immediately'::text,
    access_token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text),
    last_sent_at timestamp with time zone,
    CONSTRAINT hot_sheets_notification_schedule_check CHECK ((notification_schedule = ANY (ARRAY['immediately'::text, 'daily'::text, 'weekly'::text])))
);


ALTER TABLE public.hot_sheets OWNER TO postgres;

--
-- Name: invite_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invite_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    token_id uuid NOT NULL,
    hot_sheet_id uuid,
    client_id uuid,
    client_email text,
    event_type text NOT NULL,
    email_job_id uuid,
    actor_user_id uuid,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT invite_events_event_type_check CHECK ((event_type = ANY (ARRAY['token_created'::text, 'email_enqueued'::text, 'email_sent'::text, 'email_failed'::text, 'token_accepted'::text, 'invite_resent'::text])))
);


ALTER TABLE public.invite_events OWNER TO postgres;

--
-- Name: listing_drafts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listing_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    draft_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.listing_drafts OWNER TO postgres;

--
-- Name: listing_number_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.listing_number_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.listing_number_seq OWNER TO postgres;

--
-- Name: listing_price_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listing_price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    old_price numeric,
    new_price numeric NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid,
    note text
);


ALTER TABLE public.listing_price_history OWNER TO postgres;

--
-- Name: listing_shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listing_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    shared_by uuid,
    share_type text NOT NULL,
    recipient_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.listing_shares OWNER TO postgres;

--
-- Name: listing_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listing_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    save_count integer DEFAULT 0 NOT NULL,
    contact_count integer DEFAULT 0 NOT NULL,
    showing_request_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cumulative_active_days integer DEFAULT 0 NOT NULL,
    share_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.listing_stats OWNER TO postgres;

--
-- Name: listing_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listing_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    old_status text,
    new_status text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid,
    notes text
);


ALTER TABLE public.listing_status_history OWNER TO postgres;

--
-- Name: listing_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listing_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    viewer_id uuid,
    viewer_ip text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.listing_views OWNER TO postgres;

--
-- Name: listings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_id uuid NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    zip_code text NOT NULL,
    latitude numeric,
    longitude numeric,
    property_type text,
    bedrooms integer,
    bathrooms numeric,
    square_feet integer,
    lot_size numeric,
    year_built integer,
    price numeric NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    description text,
    attom_data jsonb,
    walk_score_data jsonb,
    schools_data jsonb,
    value_estimate jsonb,
    photos jsonb DEFAULT '[]'::jsonb,
    floor_plans jsonb DEFAULT '[]'::jsonb,
    documents jsonb DEFAULT '[]'::jsonb,
    listing_type text DEFAULT 'for_sale'::text,
    commission_rate numeric(10,2),
    commission_type text DEFAULT 'percentage'::text,
    commission_notes text,
    showing_instructions text,
    lockbox_code text,
    appointment_required boolean DEFAULT false,
    showing_contact_name text,
    showing_contact_phone text,
    disclosures jsonb DEFAULT '[]'::jsonb,
    property_features jsonb DEFAULT '[]'::jsonb,
    amenities jsonb DEFAULT '[]'::jsonb,
    additional_notes text,
    annual_property_tax numeric,
    tax_year integer,
    tax_assessment_value numeric,
    activation_date date,
    open_houses jsonb DEFAULT '[]'::jsonb,
    listing_agreement_types jsonb,
    entry_only boolean,
    lender_owned boolean,
    short_sale boolean,
    property_styles jsonb,
    waterfront boolean,
    water_view boolean,
    beach_nearby boolean,
    facing_direction jsonb,
    num_fireplaces integer,
    has_basement boolean,
    garage_spaces integer,
    total_parking_spaces integer,
    construction_features jsonb,
    roof_materials jsonb,
    exterior_features_list jsonb,
    heating_types jsonb,
    cooling_types jsonb,
    green_features jsonb,
    listing_number text DEFAULT public.generate_listing_number() NOT NULL,
    active_date timestamp with time zone,
    original_listing_id uuid,
    is_relisting boolean DEFAULT false,
    cancelled_at timestamp with time zone,
    condo_details jsonb,
    multi_family_details jsonb,
    commercial_details jsonb,
    neighborhood text,
    virtual_tour_url text,
    town text,
    assessed_value numeric,
    fiscal_year integer,
    residential_exemption text,
    floors numeric,
    water_view_type text,
    lead_paint text,
    handicap_access text,
    foundation_types jsonb DEFAULT '[]'::jsonb,
    basement_types jsonb DEFAULT '[]'::jsonb,
    basement_features_list jsonb DEFAULT '[]'::jsonb,
    basement_floor_types jsonb DEFAULT '[]'::jsonb,
    parking_comments text,
    parking_features_list jsonb DEFAULT '[]'::jsonb,
    garage_comments text,
    garage_features_list jsonb DEFAULT '[]'::jsonb,
    garage_additional_features_list jsonb DEFAULT '[]'::jsonb,
    broker_comments text,
    listing_exclusions text,
    attom_id text,
    go_live_date date,
    auto_activate_on timestamp with time zone,
    auto_activate_days integer,
    county text,
    area_amenities text[],
    disclosures_other text,
    property_website_url text,
    video_url text,
    unit_number text,
    building_name text,
    rental_fee numeric,
    deposit_requirements jsonb DEFAULT '[]'::jsonb,
    outdoor_space jsonb DEFAULT '[]'::jsonb,
    has_storage boolean DEFAULT false,
    laundry_type text,
    pets_comment text,
    pet_options jsonb DEFAULT '[]'::jsonb,
    storage_options jsonb DEFAULT '[]'::jsonb,
    handicap_accessible text,
    list_date date,
    expiration_date date,
    rental_fee_text text,
    price_range_min numeric,
    price_range_max numeric,
    parking_spaces numeric,
    address_normalized text,
    CONSTRAINT chk_listing_property_type CHECK ((property_type = ANY (ARRAY['single_family'::text, 'condo'::text, 'townhouse'::text, 'multi_family'::text, 'land'::text, 'commercial'::text, 'residential_rental'::text, 'commercial_rental'::text, 'apartment'::text]))),
    CONSTRAINT chk_listing_status CHECK ((status = ANY (ARRAY['draft'::text, 'coming_soon'::text, 'active'::text, 'pending'::text, 'under_contract'::text, 'sold'::text, 'cancelled'::text, 'withdrawn'::text, 'temporarily_withdrawn'::text, 'off_market'::text, 'expired'::text, 'back_on_market'::text]))),
    CONSTRAINT listings_commission_type_check CHECK ((commission_type = ANY (ARRAY['percentage'::text, 'flat_fee'::text]))),
    CONSTRAINT listings_listing_type_check CHECK ((listing_type = ANY (ARRAY['for_sale'::text, 'for_rent'::text, 'for_private_sale'::text])))
);


ALTER TABLE public.listings OWNER TO postgres;

--
-- Name: COLUMN listings.activation_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.activation_date IS 'Date when a coming_soon listing should automatically become active';


--
-- Name: COLUMN listings.open_houses; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.open_houses IS 'Array of scheduled open houses with type (public/broker), date, start_time, end_time, and notes';


--
-- Name: COLUMN listings.condo_details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.condo_details IS 'Stores condominium-specific information including unit number, floor level, HOA fees, building amenities, pet policy, and total units in building';


--
-- Name: COLUMN listings.town; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.town IS 'Town/municipality name for more specific location data';


--
-- Name: COLUMN listings.go_live_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.go_live_date IS 'Date when Coming Soon listing should become Active';


--
-- Name: COLUMN listings.auto_activate_on; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.auto_activate_on IS 'Exact datetime when listing should auto-activate to Active status';


--
-- Name: COLUMN listings.auto_activate_days; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.auto_activate_days IS 'Optional: Number of days from creation until auto-activation';


--
-- Name: COLUMN listings.area_amenities; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.area_amenities IS 'Multi-select list of area amenities near the property';


--
-- Name: COLUMN listings.disclosures_other; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.disclosures_other IS 'Additional disclosures not covered by standard options';


--
-- Name: COLUMN listings.property_website_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.property_website_url IS 'URL to dedicated property website';


--
-- Name: COLUMN listings.video_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.video_url IS 'URL to property video (YouTube, etc)';


--
-- Name: COLUMN listings.unit_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.unit_number IS 'Unit number for condos and apartments';


--
-- Name: COLUMN listings.building_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.building_name IS 'Building or complex name';


--
-- Name: COLUMN listings.rental_fee; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.rental_fee IS 'Rental commission fee (flat amount)';


--
-- Name: COLUMN listings.deposit_requirements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.deposit_requirements IS 'Array of deposit requirement types (first_month, last_month, security_deposit, etc.)';


--
-- Name: COLUMN listings.outdoor_space; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.outdoor_space IS 'Array of outdoor space options (private, deck, balcony, etc.)';


--
-- Name: COLUMN listings.has_storage; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.has_storage IS 'Whether storage is available';


--
-- Name: COLUMN listings.laundry_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.laundry_type IS 'Laundry options: none, in_unit, in_building, hookups';


--
-- Name: COLUMN listings.pets_comment; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.listings.pets_comment IS 'Free text for pet policies and restrictions';


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    new_matches_enabled boolean DEFAULT true,
    price_changes_enabled boolean DEFAULT true,
    frequency text DEFAULT 'immediate'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    buyer_need boolean DEFAULT false NOT NULL,
    sales_intel boolean DEFAULT false NOT NULL,
    renter_need boolean DEFAULT false NOT NULL,
    general_discussion boolean DEFAULT false NOT NULL,
    min_price numeric,
    max_price numeric,
    property_types jsonb DEFAULT '[]'::jsonb,
    client_needs_enabled boolean DEFAULT true,
    client_needs_schedule text DEFAULT 'immediate'::text,
    has_no_min boolean DEFAULT false,
    has_no_max boolean DEFAULT false,
    CONSTRAINT notification_preferences_client_needs_schedule_check CHECK ((client_needs_schedule = ANY (ARRAY['immediate'::text, 'daily'::text, 'weekly'::text])))
);


ALTER TABLE public.notification_preferences OWNER TO postgres;

--
-- Name: COLUMN notification_preferences.min_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notification_preferences.min_price IS 'Minimum price for client need notifications';


--
-- Name: COLUMN notification_preferences.max_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notification_preferences.max_price IS 'Maximum price for client need notifications';


--
-- Name: COLUMN notification_preferences.property_types; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notification_preferences.property_types IS 'Array of property types agent wants notifications for (e.g., ["single_family", "condo"]). Empty array means all types.';


--
-- Name: off_market_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.off_market_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    viewer_agent_id uuid NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'direct'::text
);


ALTER TABLE public.off_market_views OWNER TO postgres;

--
-- Name: pending_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pending_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    license_state text,
    license_number text,
    created_at timestamp with time zone DEFAULT now(),
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    processed_by uuid
);


ALTER TABLE public.pending_verifications OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    phone text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deactivated_at timestamp with time zone
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: public_records_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.public_records_cache (
    attom_id text NOT NULL,
    raw jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.public_records_cache OWNER TO postgres;

--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rate_limits (
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.rate_limits OWNER TO postgres;

--
-- Name: saved_searches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.saved_searches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_workspace_id uuid NOT NULL,
    created_by uuid NOT NULL,
    name text NOT NULL,
    search_url text NOT NULL,
    criteria jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.saved_searches OWNER TO postgres;

--
-- Name: seller_match_outcomes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seller_match_outcomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    outcome public.seller_match_outcome NOT NULL,
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    outcome_at timestamp with time zone,
    next_followup_at timestamp with time zone
);


ALTER TABLE public.seller_match_outcomes OWNER TO postgres;

--
-- Name: seller_matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seller_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    hot_sheet_id uuid,
    delivery_id uuid,
    contact_attempts integer DEFAULT 0 NOT NULL,
    first_contacted_at timestamp with time zone,
    last_contacted_at timestamp with time zone,
    last_contact_note text,
    next_followup_at timestamp with time zone,
    followup_reason text,
    latest_outcome public.seller_match_outcome DEFAULT 'pending'::public.seller_match_outcome NOT NULL,
    latest_outcome_at timestamp with time zone,
    archived_at timestamp with time zone,
    archived_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    latest_outcome_id uuid,
    latest_outcome_notes text
);


ALTER TABLE public.seller_matches OWNER TO postgres;

--
-- Name: seller_matches_public; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.seller_matches_public WITH (security_invoker='true') AS
 SELECT id,
    submission_id,
    created_at,
    latest_outcome,
    latest_outcome_at,
    next_followup_at,
    archived_at
   FROM public.seller_matches sm;


ALTER VIEW public.seller_matches_public OWNER TO postgres;

--
-- Name: share_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.share_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    agent_id uuid NOT NULL,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    accepted_at timestamp with time zone,
    accepted_by_user_id uuid
);


ALTER TABLE public.share_tokens OWNER TO postgres;

--
-- Name: showing_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.showing_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    requester_name text NOT NULL,
    requester_email text NOT NULL,
    requester_phone text,
    preferred_date date NOT NULL,
    preferred_time text NOT NULL,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.showing_requests OWNER TO postgres;

--
-- Name: team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    display_order integer DEFAULT 0,
    CONSTRAINT team_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])))
);


ALTER TABLE public.team_members OWNER TO postgres;

--
-- Name: teams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    logo_url text,
    website text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    team_photo_url text,
    contact_email text,
    contact_phone text,
    social_links jsonb DEFAULT '{"twitter": "", "facebook": "", "linkedin": "", "instagram": ""}'::jsonb,
    office_name text,
    office_address text,
    office_phone text
);


ALTER TABLE public.teams OWNER TO postgres;

--
-- Name: testimonials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.testimonials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    client_name text NOT NULL,
    client_title text,
    testimonial_text text NOT NULL,
    rating integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT testimonials_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.testimonials OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: vendor_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_name text NOT NULL,
    business_type text NOT NULL,
    contact_name text NOT NULL,
    email text NOT NULL,
    phone text,
    website text,
    logo_url text,
    description text,
    service_areas jsonb DEFAULT '[]'::jsonb,
    is_approved boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vendor_profiles OWNER TO postgres;

--
-- Name: vendor_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendor_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    package_id uuid NOT NULL,
    stripe_subscription_id text,
    stripe_customer_id text,
    status text DEFAULT 'active'::text NOT NULL,
    start_date timestamp with time zone DEFAULT now() NOT NULL,
    end_date timestamp with time zone NOT NULL,
    auto_renew boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vendor_subscriptions OWNER TO postgres;

--
-- Name: email_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_events ALTER COLUMN id SET DEFAULT nextval('public.email_events_id_seq'::regclass);


--
-- Name: ad_clicks ad_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_clicks
    ADD CONSTRAINT ad_clicks_pkey PRIMARY KEY (id);


--
-- Name: ad_impressions ad_impressions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_pkey PRIMARY KEY (id);


--
-- Name: ad_packages ad_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_packages
    ADD CONSTRAINT ad_packages_pkey PRIMARY KEY (id);


--
-- Name: advertisements advertisements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advertisements
    ADD CONSTRAINT advertisements_pkey PRIMARY KEY (id);


--
-- Name: agent_buyer_coverage_areas agent_buyer_coverage_areas_agent_id_zip_code_source_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_buyer_coverage_areas
    ADD CONSTRAINT agent_buyer_coverage_areas_agent_id_zip_code_source_key UNIQUE (agent_id, zip_code, source);


--
-- Name: agent_buyer_coverage_areas agent_buyer_coverage_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_buyer_coverage_areas
    ADD CONSTRAINT agent_buyer_coverage_areas_pkey PRIMARY KEY (id);


--
-- Name: agent_county_preferences agent_county_preferences_agent_id_county_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_county_preferences
    ADD CONSTRAINT agent_county_preferences_agent_id_county_id_key UNIQUE (agent_id, county_id);


--
-- Name: agent_county_preferences agent_county_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_county_preferences
    ADD CONSTRAINT agent_county_preferences_pkey PRIMARY KEY (id);


--
-- Name: agent_early_access agent_early_access_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_early_access
    ADD CONSTRAINT agent_early_access_email_unique UNIQUE (email);


--
-- Name: agent_early_access agent_early_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_early_access
    ADD CONSTRAINT agent_early_access_pkey PRIMARY KEY (id);


--
-- Name: agent_invites agent_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_invites
    ADD CONSTRAINT agent_invites_pkey PRIMARY KEY (id);


--
-- Name: agent_license_uploads agent_license_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_license_uploads
    ADD CONSTRAINT agent_license_uploads_pkey PRIMARY KEY (id);


--
-- Name: agent_match_deliveries agent_match_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_match_deliveries
    ADD CONSTRAINT agent_match_deliveries_pkey PRIMARY KEY (id);


--
-- Name: agent_match_deliveries agent_match_deliveries_unique_match; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_match_deliveries
    ADD CONSTRAINT agent_match_deliveries_unique_match UNIQUE (submission_id, agent_id, hot_sheet_id);


--
-- Name: agent_match_submissions agent_match_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_match_submissions
    ADD CONSTRAINT agent_match_submissions_pkey PRIMARY KEY (id);


--
-- Name: agent_messages agent_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_messages
    ADD CONSTRAINT agent_messages_pkey PRIMARY KEY (id);


--
-- Name: agent_notifications agent_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_notifications
    ADD CONSTRAINT agent_notifications_pkey PRIMARY KEY (id);


--
-- Name: agent_profiles agent_profiles_aac_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_profiles
    ADD CONSTRAINT agent_profiles_aac_id_unique UNIQUE (aac_id);


--
-- Name: agent_profiles agent_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_profiles
    ADD CONSTRAINT agent_profiles_pkey PRIMARY KEY (id);


--
-- Name: agent_proposal_incentives agent_proposal_incentives_agent_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_proposal_incentives
    ADD CONSTRAINT agent_proposal_incentives_agent_id_key UNIQUE (agent_id);


--
-- Name: agent_proposal_incentives agent_proposal_incentives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_proposal_incentives
    ADD CONSTRAINT agent_proposal_incentives_pkey PRIMARY KEY (id);


--
-- Name: agent_settings agent_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_settings
    ADD CONSTRAINT agent_settings_pkey PRIMARY KEY (user_id);


--
-- Name: agent_state_preferences agent_state_preferences_agent_id_state_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_state_preferences
    ADD CONSTRAINT agent_state_preferences_agent_id_state_key UNIQUE (agent_id, state);


--
-- Name: agent_state_preferences agent_state_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_state_preferences
    ADD CONSTRAINT agent_state_preferences_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: buyer_credentials buyer_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_credentials
    ADD CONSTRAINT buyer_credentials_pkey PRIMARY KEY (id);


--
-- Name: client_needs buyer_needs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_needs
    ADD CONSTRAINT buyer_needs_pkey PRIMARY KEY (id);


--
-- Name: buyer_qualifications buyer_qualifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_qualifications
    ADD CONSTRAINT buyer_qualifications_pkey PRIMARY KEY (id);


--
-- Name: buyer_qualifications buyer_qualifications_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_qualifications
    ADD CONSTRAINT buyer_qualifications_user_id_key UNIQUE (user_id);


--
-- Name: buyer_workspace_invites buyer_workspace_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_workspace_invites
    ADD CONSTRAINT buyer_workspace_invites_pkey PRIMARY KEY (id);


--
-- Name: buyer_workspace_invites buyer_workspace_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_workspace_invites
    ADD CONSTRAINT buyer_workspace_invites_token_key UNIQUE (token);


--
-- Name: buyer_workspace_members buyer_workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_workspace_members
    ADD CONSTRAINT buyer_workspace_members_pkey PRIMARY KEY (id);


--
-- Name: buyer_workspace_members buyer_workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_workspace_members
    ADD CONSTRAINT buyer_workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: buyer_workspaces buyer_workspaces_owner_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_workspaces
    ADD CONSTRAINT buyer_workspaces_owner_id_key UNIQUE (owner_id);


--
-- Name: buyer_workspaces buyer_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_workspaces
    ADD CONSTRAINT buyer_workspaces_pkey PRIMARY KEY (id);


--
-- Name: client_agent_messages client_agent_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_agent_messages
    ADD CONSTRAINT client_agent_messages_pkey PRIMARY KEY (id);


--
-- Name: client_agent_relationships client_agent_relationships_client_id_agent_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_agent_relationships
    ADD CONSTRAINT client_agent_relationships_client_id_agent_id_key UNIQUE (client_id, agent_id);


--
-- Name: client_agent_relationships client_agent_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_agent_relationships
    ADD CONSTRAINT client_agent_relationships_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: coming_soon_signups coming_soon_signups_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coming_soon_signups
    ADD CONSTRAINT coming_soon_signups_email_key UNIQUE (email);


--
-- Name: coming_soon_signups coming_soon_signups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coming_soon_signups
    ADD CONSTRAINT coming_soon_signups_pkey PRIMARY KEY (id);


--
-- Name: conversation_messages conversation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: counties counties_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counties
    ADD CONSTRAINT counties_name_key UNIQUE (name);


--
-- Name: counties counties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.counties
    ADD CONSTRAINT counties_pkey PRIMARY KEY (id);


--
-- Name: deleted_users deleted_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deleted_users
    ADD CONSTRAINT deleted_users_pkey PRIMARY KEY (id);


--
-- Name: email_campaigns email_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_pkey PRIMARY KEY (id);


--
-- Name: email_clicks email_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_clicks
    ADD CONSTRAINT email_clicks_pkey PRIMARY KEY (id);


--
-- Name: email_events email_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_pkey PRIMARY KEY (id);


--
-- Name: email_jobs email_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_jobs
    ADD CONSTRAINT email_jobs_pkey PRIMARY KEY (id);


--
-- Name: email_opens email_opens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_opens
    ADD CONSTRAINT email_opens_pkey PRIMARY KEY (id);


--
-- Name: email_sends email_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_sends
    ADD CONSTRAINT email_sends_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: favorite_price_history favorite_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorite_price_history
    ADD CONSTRAINT favorite_price_history_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_user_id_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_listing_id_key UNIQUE (user_id, listing_id);


--
-- Name: feature_flags feature_flags_flag_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_flag_name_key UNIQUE (flag_name);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: hot_sheet_clients hot_sheet_clients_hot_sheet_id_client_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_clients
    ADD CONSTRAINT hot_sheet_clients_hot_sheet_id_client_id_key UNIQUE (hot_sheet_id, client_id);


--
-- Name: hot_sheet_clients hot_sheet_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_clients
    ADD CONSTRAINT hot_sheet_clients_pkey PRIMARY KEY (id);


--
-- Name: hot_sheet_comments hot_sheet_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_comments
    ADD CONSTRAINT hot_sheet_comments_pkey PRIMARY KEY (id);


--
-- Name: hot_sheet_favorites hot_sheet_favorites_hot_sheet_id_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_favorites
    ADD CONSTRAINT hot_sheet_favorites_hot_sheet_id_listing_id_key UNIQUE (hot_sheet_id, listing_id);


--
-- Name: hot_sheet_favorites hot_sheet_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_favorites
    ADD CONSTRAINT hot_sheet_favorites_pkey PRIMARY KEY (id);


--
-- Name: hot_sheet_listing_status hot_sheet_listing_status_hot_sheet_id_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_listing_status
    ADD CONSTRAINT hot_sheet_listing_status_hot_sheet_id_listing_id_key UNIQUE (hot_sheet_id, listing_id);


--
-- Name: hot_sheet_listing_status hot_sheet_listing_status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_listing_status
    ADD CONSTRAINT hot_sheet_listing_status_pkey PRIMARY KEY (id);


--
-- Name: hot_sheet_notifications hot_sheet_notifications_hot_sheet_id_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_notifications
    ADD CONSTRAINT hot_sheet_notifications_hot_sheet_id_listing_id_key UNIQUE (hot_sheet_id, listing_id);


--
-- Name: hot_sheet_notifications hot_sheet_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_notifications
    ADD CONSTRAINT hot_sheet_notifications_pkey PRIMARY KEY (id);


--
-- Name: hot_sheet_sent_listings hot_sheet_sent_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_sent_listings
    ADD CONSTRAINT hot_sheet_sent_listings_pkey PRIMARY KEY (id);


--
-- Name: hot_sheet_shares hot_sheet_shares_hot_sheet_id_shared_with_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_shares
    ADD CONSTRAINT hot_sheet_shares_hot_sheet_id_shared_with_email_key UNIQUE (hot_sheet_id, shared_with_email);


--
-- Name: hot_sheet_shares hot_sheet_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_shares
    ADD CONSTRAINT hot_sheet_shares_pkey PRIMARY KEY (id);


--
-- Name: hot_sheet_subscribers hot_sheet_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_subscribers
    ADD CONSTRAINT hot_sheet_subscribers_pkey PRIMARY KEY (id);


--
-- Name: hot_sheets hot_sheets_access_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheets
    ADD CONSTRAINT hot_sheets_access_token_key UNIQUE (access_token);


--
-- Name: hot_sheets hot_sheets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheets
    ADD CONSTRAINT hot_sheets_pkey PRIMARY KEY (id);


--
-- Name: invite_events invite_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invite_events
    ADD CONSTRAINT invite_events_pkey PRIMARY KEY (id);


--
-- Name: listing_drafts listing_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_drafts
    ADD CONSTRAINT listing_drafts_pkey PRIMARY KEY (id);


--
-- Name: listing_price_history listing_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_price_history
    ADD CONSTRAINT listing_price_history_pkey PRIMARY KEY (id);


--
-- Name: listing_shares listing_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_shares
    ADD CONSTRAINT listing_shares_pkey PRIMARY KEY (id);


--
-- Name: listing_stats listing_stats_listing_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_stats
    ADD CONSTRAINT listing_stats_listing_id_key UNIQUE (listing_id);


--
-- Name: listing_stats listing_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_stats
    ADD CONSTRAINT listing_stats_pkey PRIMARY KEY (id);


--
-- Name: listing_status_history listing_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_status_history
    ADD CONSTRAINT listing_status_history_pkey PRIMARY KEY (id);


--
-- Name: listing_views listing_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_views
    ADD CONSTRAINT listing_views_pkey PRIMARY KEY (id);


--
-- Name: listings listings_listing_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_listing_number_unique UNIQUE (listing_number);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: off_market_views off_market_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.off_market_views
    ADD CONSTRAINT off_market_views_pkey PRIMARY KEY (id);


--
-- Name: pending_verifications pending_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pending_verifications
    ADD CONSTRAINT pending_verifications_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: public_records_cache public_records_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_records_cache
    ADD CONSTRAINT public_records_cache_pkey PRIMARY KEY (attom_id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key, window_start);


--
-- Name: saved_searches saved_searches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_searches
    ADD CONSTRAINT saved_searches_pkey PRIMARY KEY (id);


--
-- Name: seller_match_outcomes seller_match_outcomes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_match_outcomes
    ADD CONSTRAINT seller_match_outcomes_pkey PRIMARY KEY (id);


--
-- Name: seller_matches seller_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_matches
    ADD CONSTRAINT seller_matches_pkey PRIMARY KEY (id);


--
-- Name: seller_matches seller_matches_submission_id_agent_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_matches
    ADD CONSTRAINT seller_matches_submission_id_agent_id_key UNIQUE (submission_id, agent_id);


--
-- Name: share_tokens share_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.share_tokens
    ADD CONSTRAINT share_tokens_pkey PRIMARY KEY (id);


--
-- Name: share_tokens share_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.share_tokens
    ADD CONSTRAINT share_tokens_token_key UNIQUE (token);


--
-- Name: showing_requests showing_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.showing_requests
    ADD CONSTRAINT showing_requests_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_agent_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_agent_id_key UNIQUE (team_id, agent_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: testimonials testimonials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);


--
-- Name: conversations unique_conversation; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT unique_conversation UNIQUE (agent_a_id, agent_b_id, listing_id, buyer_need_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: vendor_profiles vendor_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_profiles
    ADD CONSTRAINT vendor_profiles_pkey PRIMARY KEY (id);


--
-- Name: vendor_subscriptions vendor_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_subscriptions
    ADD CONSTRAINT vendor_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: agent_early_access_email_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX agent_early_access_email_lower_idx ON public.agent_early_access USING btree (lower(email));


--
-- Name: agent_settings_agent_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX agent_settings_agent_status_idx ON public.agent_settings USING btree (agent_status);


--
-- Name: agent_settings_onboarding_completed_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX agent_settings_onboarding_completed_idx ON public.agent_settings USING btree (onboarding_completed);


--
-- Name: car_agent_client_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX car_agent_client_idx ON public.client_agent_relationships USING btree (agent_id, client_id);


--
-- Name: car_agent_crm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX car_agent_crm_idx ON public.client_agent_relationships USING btree (agent_id, crm_client_id);


--
-- Name: car_client_status_agent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX car_client_status_agent_idx ON public.client_agent_relationships USING btree (client_id, status, agent_id);


--
-- Name: car_unique_active_agent_crm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX car_unique_active_agent_crm ON public.client_agent_relationships USING btree (agent_id, crm_client_id) WHERE ((crm_client_id IS NOT NULL) AND (ended_at IS NULL));


--
-- Name: client_agent_messages_agent_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX client_agent_messages_agent_id_idx ON public.client_agent_messages USING btree (agent_id);


--
-- Name: client_agent_messages_client_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX client_agent_messages_client_id_idx ON public.client_agent_messages USING btree (client_id);


--
-- Name: client_agent_messages_sender_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX client_agent_messages_sender_user_id_idx ON public.client_agent_messages USING btree (sender_user_id);


--
-- Name: client_agent_relationships_one_active_per_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX client_agent_relationships_one_active_per_client ON public.client_agent_relationships USING btree (client_id) WHERE (status = 'active'::text);


--
-- Name: clients_email_normalized_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clients_email_normalized_idx ON public.clients USING btree (lower(TRIM(BOTH FROM email)));


--
-- Name: email_jobs_idempotency_key_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX email_jobs_idempotency_key_unique ON public.email_jobs USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: hot_sheet_sent_listings_hs_listing_status_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX hot_sheet_sent_listings_hs_listing_status_unique ON public.hot_sheet_sent_listings USING btree (hot_sheet_id, listing_id, status_at_send);


--
-- Name: idx_ad_clicks_ad_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ad_clicks_ad_id ON public.ad_clicks USING btree (ad_id);


--
-- Name: idx_ad_clicks_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ad_clicks_created_at ON public.ad_clicks USING btree (created_at);


--
-- Name: idx_ad_impressions_ad_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ad_impressions_ad_id ON public.ad_impressions USING btree (ad_id);


--
-- Name: idx_ad_impressions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ad_impressions_created_at ON public.ad_impressions USING btree (created_at);


--
-- Name: idx_advertisements_ad_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_advertisements_ad_type ON public.advertisements USING btree (ad_type);


--
-- Name: idx_advertisements_placement_zone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_advertisements_placement_zone ON public.advertisements USING btree (placement_zone);


--
-- Name: idx_advertisements_vendor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_advertisements_vendor_id ON public.advertisements USING btree (vendor_id);


--
-- Name: idx_agent_buyer_coverage_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_buyer_coverage_agent ON public.agent_buyer_coverage_areas USING btree (agent_id);


--
-- Name: idx_agent_buyer_coverage_neighborhood; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_buyer_coverage_neighborhood ON public.agent_buyer_coverage_areas USING btree (agent_id, neighborhood, city, state);


--
-- Name: idx_agent_buyer_coverage_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_buyer_coverage_source ON public.agent_buyer_coverage_areas USING btree (agent_id, source);


--
-- Name: idx_agent_buyer_coverage_zip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_buyer_coverage_zip ON public.agent_buyer_coverage_areas USING btree (zip_code);


--
-- Name: idx_agent_early_access_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_early_access_email ON public.agent_early_access USING btree (email);


--
-- Name: idx_agent_invites_invitee_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_invites_invitee_email ON public.agent_invites USING btree (lower(invitee_email));


--
-- Name: idx_agent_invites_inviter; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_invites_inviter ON public.agent_invites USING btree (inviter_user_id);


--
-- Name: idx_agent_match_submissions_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_match_submissions_expires_at ON public.agent_match_submissions USING btree (expires_at) WHERE (status = 'paid'::text);


--
-- Name: idx_agent_profiles_created_at_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_profiles_created_at_id ON public.agent_profiles USING btree (created_at DESC, id DESC);


--
-- Name: idx_agent_profiles_office_state_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agent_profiles_office_state_created_at ON public.agent_profiles USING btree (office_state, created_at DESC);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_table_record; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_table_record ON public.audit_logs USING btree (table_name, record_id);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_buyer_credentials_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_buyer_credentials_status ON public.buyer_credentials USING btree (verification_status);


--
-- Name: idx_buyer_credentials_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_buyer_credentials_user_id ON public.buyer_credentials USING btree (user_id);


--
-- Name: idx_bwi_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwi_agent ON public.buyer_workspace_invites USING btree (agent_id);


--
-- Name: idx_bwi_created_by_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwi_created_by_pending ON public.buyer_workspace_invites USING btree (created_by_user_id, created_at DESC) WHERE (accepted_at IS NULL);


--
-- Name: idx_bwi_last_resent_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwi_last_resent_at ON public.buyer_workspace_invites USING btree (last_resent_at);


--
-- Name: idx_bwi_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwi_workspace ON public.buyer_workspace_invites USING btree (workspace_id);


--
-- Name: idx_bwi_workspace_email_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwi_workspace_email_pending ON public.buyer_workspace_invites USING btree (workspace_id, buyer_email) WHERE (accepted_at IS NULL);


--
-- Name: idx_bwi_workspace_pending_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bwi_workspace_pending_created_at ON public.buyer_workspace_invites USING btree (workspace_id, created_at DESC) WHERE (accepted_at IS NULL);


--
-- Name: idx_client_agent_relationships_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_agent_relationships_active ON public.client_agent_relationships USING btree (client_id, agent_id) WHERE (status = 'active'::text);


--
-- Name: idx_client_agent_relationships_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_agent_relationships_agent_id ON public.client_agent_relationships USING btree (agent_id);


--
-- Name: idx_client_agent_relationships_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_agent_relationships_client_id ON public.client_agent_relationships USING btree (client_id);


--
-- Name: idx_client_agent_relationships_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_agent_relationships_status ON public.client_agent_relationships USING btree (client_id, status);


--
-- Name: idx_client_needs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_needs_created_at ON public.client_needs USING btree (created_at DESC);


--
-- Name: idx_client_needs_state_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_needs_state_created_at ON public.client_needs USING btree (state, created_at DESC);


--
-- Name: idx_client_needs_submitted_by_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_client_needs_submitted_by_created_at ON public.client_needs USING btree (submitted_by, created_at DESC);


--
-- Name: idx_clients_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_agent_id ON public.clients USING btree (agent_id);


--
-- Name: idx_coming_soon_signups_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_coming_soon_signups_email ON public.coming_soon_signups USING btree (email);


--
-- Name: idx_conversation_messages_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_messages_conversation ON public.conversation_messages USING btree (conversation_id);


--
-- Name: idx_conversation_messages_recipient_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_messages_recipient_read ON public.conversation_messages USING btree (recipient_agent_id, read_at);


--
-- Name: idx_conversation_participants_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_participants_user ON public.conversation_participants USING btree (user_id, conversation_id);


--
-- Name: idx_conversations_agent_a; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_agent_a ON public.conversations USING btree (agent_a_id);


--
-- Name: idx_conversations_agent_b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_agent_b ON public.conversations USING btree (agent_b_id);


--
-- Name: idx_conversations_last_message_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_last_message_at ON public.conversations USING btree (last_message_at DESC);


--
-- Name: idx_conversations_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_updated_at ON public.conversations USING btree (updated_at DESC);


--
-- Name: idx_email_clicks_send; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_clicks_send ON public.email_clicks USING btree (email_send_id);


--
-- Name: idx_email_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_events_created_at ON public.email_events USING btree (created_at DESC);


--
-- Name: idx_email_events_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_events_job_id ON public.email_events USING btree (job_id);


--
-- Name: idx_email_jobs_queue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_jobs_queue ON public.email_jobs USING btree (status, run_after, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'processing'::text]));


--
-- Name: idx_email_jobs_status_run_after_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_jobs_status_run_after_created_at ON public.email_jobs USING btree (status, run_after, created_at) WHERE (status = 'queued'::text);


--
-- Name: idx_email_opens_send; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_opens_send ON public.email_opens USING btree (email_send_id);


--
-- Name: idx_email_sends_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_sends_campaign ON public.email_sends USING btree (campaign_id);


--
-- Name: idx_email_templates_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_templates_agent_id ON public.email_templates USING btree (agent_id);


--
-- Name: idx_email_templates_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_templates_category ON public.email_templates USING btree (category);


--
-- Name: idx_favorite_price_history_favorite_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_favorite_price_history_favorite_id ON public.favorite_price_history USING btree (favorite_id);


--
-- Name: idx_favorite_price_history_notification_sent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_favorite_price_history_notification_sent ON public.favorite_price_history USING btree (notification_sent) WHERE (notification_sent = false);


--
-- Name: idx_favorites_listing_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_favorites_listing_id ON public.favorites USING btree (listing_id);


--
-- Name: idx_favorites_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_favorites_user_id ON public.favorites USING btree (user_id);


--
-- Name: idx_favorites_user_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_favorites_user_id_created_at ON public.favorites USING btree (user_id, created_at DESC);


--
-- Name: idx_hot_sheet_clients_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_clients_client ON public.hot_sheet_clients USING btree (client_id);


--
-- Name: idx_hot_sheet_clients_hot_sheet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_clients_hot_sheet ON public.hot_sheet_clients USING btree (hot_sheet_id);


--
-- Name: idx_hot_sheet_comments_hot_sheet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_comments_hot_sheet ON public.hot_sheet_comments USING btree (hot_sheet_id);


--
-- Name: idx_hot_sheet_comments_hs_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_comments_hs_listing ON public.hot_sheet_comments USING btree (hot_sheet_id, listing_id);


--
-- Name: idx_hot_sheet_favorites_hot_sheet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_favorites_hot_sheet ON public.hot_sheet_favorites USING btree (hot_sheet_id);


--
-- Name: idx_hot_sheet_listing_status_hot_sheet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_listing_status_hot_sheet ON public.hot_sheet_listing_status USING btree (hot_sheet_id);


--
-- Name: idx_hot_sheet_listing_status_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_listing_status_listing ON public.hot_sheet_listing_status USING btree (listing_id);


--
-- Name: idx_hot_sheet_listing_status_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_listing_status_status ON public.hot_sheet_listing_status USING btree (status);


--
-- Name: idx_hot_sheet_notifications_hot_sheet_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_notifications_hot_sheet_id ON public.hot_sheet_notifications USING btree (hot_sheet_id);


--
-- Name: idx_hot_sheet_notifications_listing_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_notifications_listing_id ON public.hot_sheet_notifications USING btree (listing_id);


--
-- Name: idx_hot_sheet_notifications_notification_sent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_notifications_notification_sent ON public.hot_sheet_notifications USING btree (notification_sent) WHERE (notification_sent = false);


--
-- Name: idx_hot_sheet_sent_listings_hot_sheet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_sent_listings_hot_sheet ON public.hot_sheet_sent_listings USING btree (hot_sheet_id);


--
-- Name: idx_hot_sheet_sent_listings_listing; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_sent_listings_listing ON public.hot_sheet_sent_listings USING btree (listing_id);


--
-- Name: idx_hot_sheet_shares_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_shares_email ON public.hot_sheet_shares USING btree (shared_with_email);


--
-- Name: idx_hot_sheet_shares_hot_sheet_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheet_shares_hot_sheet_id ON public.hot_sheet_shares USING btree (hot_sheet_id);


--
-- Name: idx_hot_sheets_access_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheets_access_token ON public.hot_sheets USING btree (access_token);


--
-- Name: idx_hot_sheets_client_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheets_client_id ON public.hot_sheets USING btree (client_id);


--
-- Name: idx_hot_sheets_client_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheets_client_id_created_at ON public.hot_sheets USING btree (client_id, created_at DESC);


--
-- Name: idx_hot_sheets_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheets_is_active ON public.hot_sheets USING btree (is_active);


--
-- Name: idx_hot_sheets_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheets_user_id ON public.hot_sheets USING btree (user_id);


--
-- Name: idx_hot_sheets_user_id_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hot_sheets_user_id_created_at ON public.hot_sheets USING btree (user_id, created_at DESC);


--
-- Name: idx_hss_preview_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_hss_preview_token ON public.hot_sheet_subscribers USING btree (preview_token);


--
-- Name: idx_listing_drafts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_drafts_user_id ON public.listing_drafts USING btree (user_id);


--
-- Name: idx_listing_drafts_user_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_listing_drafts_user_unique ON public.listing_drafts USING btree (user_id);


--
-- Name: idx_listing_price_history_changed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_price_history_changed_at ON public.listing_price_history USING btree (changed_at DESC);


--
-- Name: idx_listing_price_history_listing_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_price_history_listing_id ON public.listing_price_history USING btree (listing_id);


--
-- Name: idx_listing_shares_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_shares_created_at ON public.listing_shares USING btree (created_at);


--
-- Name: idx_listing_shares_listing_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_shares_listing_id ON public.listing_shares USING btree (listing_id);


--
-- Name: idx_listing_stats_listing_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_stats_listing_id ON public.listing_stats USING btree (listing_id);


--
-- Name: idx_listing_status_history_changed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_status_history_changed_at ON public.listing_status_history USING btree (changed_at DESC);


--
-- Name: idx_listing_status_history_listing_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_status_history_listing_id ON public.listing_status_history USING btree (listing_id);


--
-- Name: idx_listing_views_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_views_created_at ON public.listing_views USING btree (created_at);


--
-- Name: idx_listing_views_listing_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listing_views_listing_id ON public.listing_views USING btree (listing_id);


--
-- Name: idx_listings_address_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_address_status ON public.listings USING btree (address, city, state, zip_code, status);


--
-- Name: idx_listings_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_agent_id ON public.listings USING btree (agent_id);


--
-- Name: idx_listings_city_status_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_city_status_created_at ON public.listings USING btree (city, status, created_at DESC);


--
-- Name: idx_listings_created_at_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_created_at_id ON public.listings USING btree (created_at DESC, id DESC);


--
-- Name: idx_listings_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_location ON public.listings USING btree (city, state, zip_code);


--
-- Name: idx_listings_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_price ON public.listings USING btree (price);


--
-- Name: idx_listings_state_status_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_state_status_created_at ON public.listings USING btree (state, status, created_at DESC);


--
-- Name: idx_listings_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_status ON public.listings USING btree (status);


--
-- Name: idx_listings_status_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_status_created_at ON public.listings USING btree (status, created_at DESC);


--
-- Name: idx_listings_zip_status_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_listings_zip_status_created_at ON public.listings USING btree (zip_code, status, created_at DESC);


--
-- Name: idx_off_market_views_listing_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_off_market_views_listing_id ON public.off_market_views USING btree (listing_id);


--
-- Name: idx_off_market_views_viewer_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_off_market_views_viewer_agent_id ON public.off_market_views USING btree (viewer_agent_id);


--
-- Name: idx_rate_limits_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rate_limits_updated_at ON public.rate_limits USING btree (updated_at);


--
-- Name: idx_saved_searches_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_saved_searches_workspace ON public.saved_searches USING btree (buyer_workspace_id);


--
-- Name: idx_seller_match_outcomes_match; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_match_outcomes_match ON public.seller_match_outcomes USING btree (match_id);


--
-- Name: idx_seller_match_outcomes_match_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_match_outcomes_match_created ON public.seller_match_outcomes USING btree (match_id, created_at DESC);


--
-- Name: idx_seller_match_outcomes_next_followup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_match_outcomes_next_followup ON public.seller_match_outcomes USING btree (next_followup_at);


--
-- Name: idx_seller_match_outcomes_outcome; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_match_outcomes_outcome ON public.seller_match_outcomes USING btree (outcome);


--
-- Name: idx_seller_matches_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_agent ON public.seller_matches USING btree (agent_id);


--
-- Name: idx_seller_matches_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_agent_id ON public.seller_matches USING btree (agent_id);


--
-- Name: idx_seller_matches_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_archived ON public.seller_matches USING btree (archived_at) WHERE (archived_at IS NULL);


--
-- Name: idx_seller_matches_archived_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_archived_at ON public.seller_matches USING btree (archived_at);


--
-- Name: idx_seller_matches_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_created_at ON public.seller_matches USING btree (created_at DESC);


--
-- Name: idx_seller_matches_delivery_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_delivery_id ON public.seller_matches USING btree (delivery_id);


--
-- Name: idx_seller_matches_followup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_followup ON public.seller_matches USING btree (next_followup_at) WHERE (next_followup_at IS NOT NULL);


--
-- Name: idx_seller_matches_latest_outcome; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_latest_outcome ON public.seller_matches USING btree (latest_outcome);


--
-- Name: idx_seller_matches_next_followup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_next_followup ON public.seller_matches USING btree (next_followup_at);


--
-- Name: idx_seller_matches_outcome; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_outcome ON public.seller_matches USING btree (latest_outcome);


--
-- Name: idx_seller_matches_submission; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_submission ON public.seller_matches USING btree (submission_id);


--
-- Name: idx_seller_matches_submission_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_seller_matches_submission_id ON public.seller_matches USING btree (submission_id);


--
-- Name: idx_share_tokens_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_share_tokens_agent_id ON public.share_tokens USING btree (agent_id);


--
-- Name: idx_share_tokens_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_share_tokens_expires_at ON public.share_tokens USING btree (expires_at);


--
-- Name: idx_vendor_profiles_business_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_profiles_business_type ON public.vendor_profiles USING btree (business_type);


--
-- Name: idx_vendor_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_profiles_user_id ON public.vendor_profiles USING btree (user_id);


--
-- Name: idx_vendor_subscriptions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_subscriptions_status ON public.vendor_subscriptions USING btree (status);


--
-- Name: idx_vendor_subscriptions_vendor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendor_subscriptions_vendor_id ON public.vendor_subscriptions USING btree (vendor_id);


--
-- Name: invite_events_client_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX invite_events_client_email_idx ON public.invite_events USING btree (client_email);


--
-- Name: invite_events_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX invite_events_created_at_idx ON public.invite_events USING btree (created_at);


--
-- Name: invite_events_hot_sheet_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX invite_events_hot_sheet_id_idx ON public.invite_events USING btree (hot_sheet_id);


--
-- Name: invite_events_token_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX invite_events_token_id_idx ON public.invite_events USING btree (token_id);


--
-- Name: listings_unique_live_address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX listings_unique_live_address ON public.listings USING btree (address_normalized, city, state, zip_code) WHERE (status = ANY (ARRAY['active'::text, 'new'::text, 'coming_soon'::text, 'off_market'::text, 'back_on_market'::text, 'price_changed'::text, 'extended'::text, 'reactivated'::text, 'under_agreement'::text, 'pending'::text, 'contingent'::text]));


--
-- Name: uniq_bwi_pending_invite_per_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uniq_bwi_pending_invite_per_email ON public.buyer_workspace_invites USING btree (workspace_id, lower(buyer_email)) WHERE (accepted_at IS NULL);


--
-- Name: uniq_hss_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uniq_hss_active ON public.hot_sheet_subscribers USING btree (hot_sheet_id, lower(email)) WHERE (status = 'active'::text);


--
-- Name: agent_profiles agent_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER agent_profiles_updated_at BEFORE UPDATE ON public.agent_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: agent_settings agent_settings_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER agent_settings_set_updated_at BEFORE UPDATE ON public.agent_settings FOR EACH ROW EXECUTE FUNCTION public.set_agent_settings_updated_at();


--
-- Name: agent_county_preferences audit_county_preference_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_county_preference_delete AFTER DELETE ON public.agent_county_preferences FOR EACH ROW EXECUTE FUNCTION public.log_county_preference_change();


--
-- Name: agent_county_preferences audit_county_preference_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_county_preference_insert AFTER INSERT ON public.agent_county_preferences FOR EACH ROW EXECUTE FUNCTION public.log_county_preference_change();


--
-- Name: listings audit_listing_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_listing_delete AFTER DELETE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.log_listing_change();


--
-- Name: listings audit_listing_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_listing_update AFTER UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.log_listing_change();


--
-- Name: agent_profiles audit_profile_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER audit_profile_update AFTER UPDATE ON public.agent_profiles FOR EACH ROW EXECUTE FUNCTION public.log_profile_change();


--
-- Name: agent_match_deliveries create_seller_match_on_delivery_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER create_seller_match_on_delivery_insert AFTER INSERT ON public.agent_match_deliveries FOR EACH ROW EXECUTE FUNCTION public.create_seller_match_on_delivery();


--
-- Name: hot_sheets delete_hot_sheet_client_needs_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER delete_hot_sheet_client_needs_trigger BEFORE DELETE ON public.hot_sheets FOR EACH ROW EXECUTE FUNCTION public.delete_hot_sheet_client_needs();


--
-- Name: client_agent_relationships enforce_single_active_agent; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER enforce_single_active_agent BEFORE INSERT OR UPDATE ON public.client_agent_relationships FOR EACH ROW EXECUTE FUNCTION public.check_single_active_agent();


--
-- Name: listings normalize_listing_address_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER normalize_listing_address_trigger BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.normalize_listing_address();


--
-- Name: listings notify_matching_buyers_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER notify_matching_buyers_trigger AFTER INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.notify_matching_buyers_on_new_listing();


--
-- Name: client_needs on_client_need_created; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_client_need_created AFTER INSERT ON public.client_needs FOR EACH ROW EXECUTE FUNCTION public.notify_agents_of_client_need();


--
-- Name: favorites on_favorite_change_update_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_favorite_change_update_stats AFTER INSERT OR DELETE ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.update_listing_save_count();


--
-- Name: listings on_listing_cancelled_set_date; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_listing_cancelled_set_date BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.set_cancelled_date();


--
-- Name: listings on_listing_change_fetch_data; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_listing_change_fetch_data AFTER INSERT OR UPDATE OF address ON public.listings FOR EACH ROW EXECUTE FUNCTION public.trigger_property_data_fetch();


--
-- Name: TRIGGER on_listing_change_fetch_data ON listings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TRIGGER on_listing_change_fetch_data ON public.listings IS 'Triggers automatic property data fetch on listing creation or address update';


--
-- Name: listings on_listing_created_check_relisting; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_listing_created_check_relisting BEFORE INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION public.check_and_link_relisting();


--
-- Name: listings on_listing_created_init_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_listing_created_init_stats AFTER INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION public.initialize_listing_stats();


--
-- Name: listing_shares on_listing_shared_update_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_listing_shared_update_stats AFTER INSERT ON public.listing_shares FOR EACH ROW EXECUTE FUNCTION public.update_listing_share_count();


--
-- Name: listings on_listing_status_active; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_listing_status_active BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.set_listing_active_date();


--
-- Name: listings on_listing_status_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_listing_status_change AFTER UPDATE ON public.listings FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.log_listing_status_change();


--
-- Name: listing_views on_listing_viewed_update_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_listing_viewed_update_stats AFTER INSERT ON public.listing_views FOR EACH ROW EXECUTE FUNCTION public.update_listing_view_count();


--
-- Name: agent_messages on_message_sent_update_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_message_sent_update_stats AFTER INSERT ON public.agent_messages FOR EACH ROW EXECUTE FUNCTION public.update_listing_contact_count();


--
-- Name: showing_requests on_showing_request_update_stats; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_showing_request_update_stats AFTER INSERT ON public.showing_requests FOR EACH ROW EXECUTE FUNCTION public.update_listing_showing_count();


--
-- Name: agent_profiles set_aac_id_before_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_aac_id_before_insert BEFORE INSERT ON public.agent_profiles FOR EACH ROW EXECUTE FUNCTION public.set_aac_id_on_insert();


--
-- Name: agent_license_uploads set_license_uploads_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_license_uploads_updated_at BEFORE UPDATE ON public.agent_license_uploads FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: seller_matches set_seller_matches_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_seller_matches_updated_at BEFORE UPDATE ON public.seller_matches FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: hot_sheets sync_hot_sheet_to_client_needs_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER sync_hot_sheet_to_client_needs_trigger AFTER INSERT OR UPDATE ON public.hot_sheets FOR EACH ROW EXECUTE FUNCTION public.sync_hot_sheet_to_client_needs();


--
-- Name: listings track_listing_price_changes; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER track_listing_price_changes AFTER UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.track_favorite_price_changes();


--
-- Name: user_roles trg_auto_create_buyer_workspace; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_auto_create_buyer_workspace AFTER INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.auto_create_buyer_workspace();


--
-- Name: conversations trg_auto_create_participants; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_auto_create_participants AFTER INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.auto_create_conversation_participants();


--
-- Name: conversation_messages trg_conversation_message_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_conversation_message_insert AFTER INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message_at();


--
-- Name: conversation_messages trg_enqueue_message_email; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_enqueue_message_email AFTER INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.enqueue_message_email();


--
-- Name: hot_sheet_comments trg_hot_sheet_comment_inserted; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_hot_sheet_comment_inserted AFTER INSERT ON public.hot_sheet_comments FOR EACH ROW EXECUTE FUNCTION public.on_hot_sheet_comment_inserted();


--
-- Name: buyer_workspace_invites trg_prevent_bwi_acceptance_overwrite; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prevent_bwi_acceptance_overwrite BEFORE UPDATE ON public.buyer_workspace_invites FOR EACH ROW EXECUTE FUNCTION public.prevent_bwi_acceptance_overwrite();


--
-- Name: seller_match_outcomes trg_seller_match_outcomes_latest; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_seller_match_outcomes_latest AFTER INSERT ON public.seller_match_outcomes FOR EACH ROW EXECUTE FUNCTION public.update_seller_match_latest_outcome();


--
-- Name: advertisements update_advertisements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_advertisements_updated_at BEFORE UPDATE ON public.advertisements FOR EACH ROW EXECUTE FUNCTION public.update_vendor_updated_at();


--
-- Name: agent_match_submissions update_agent_match_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_agent_match_submissions_updated_at BEFORE UPDATE ON public.agent_match_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: buyer_credentials update_buyer_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_buyer_credentials_updated_at BEFORE UPDATE ON public.buyer_credentials FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: conversation_messages update_conversation_on_message; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_conversation_on_message AFTER INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();


--
-- Name: listings update_cumulative_days_on_status_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_cumulative_days_on_status_change AFTER INSERT OR UPDATE OF status ON public.listings FOR EACH ROW EXECUTE FUNCTION public.update_cumulative_active_days();


--
-- Name: email_templates update_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: hot_sheet_comments update_hot_sheet_comments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_hot_sheet_comments_updated_at BEFORE UPDATE ON public.hot_sheet_comments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: hot_sheet_listing_status update_hot_sheet_listing_status_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_hot_sheet_listing_status_updated_at BEFORE UPDATE ON public.hot_sheet_listing_status FOR EACH ROW EXECUTE FUNCTION public.update_hot_sheet_listing_status_updated_at();


--
-- Name: hot_sheets update_hot_sheets_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_hot_sheets_updated_at BEFORE UPDATE ON public.hot_sheets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: listing_drafts update_listing_drafts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_listing_drafts_updated_at BEFORE UPDATE ON public.listing_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: listings update_listings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: notification_preferences update_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: showing_requests update_showing_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_showing_requests_updated_at BEFORE UPDATE ON public.showing_requests FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: teams update_teams_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: testimonials update_testimonials_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_testimonials_updated_at BEFORE UPDATE ON public.testimonials FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: vendor_profiles update_vendor_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_vendor_profiles_updated_at BEFORE UPDATE ON public.vendor_profiles FOR EACH ROW EXECUTE FUNCTION public.update_vendor_updated_at();


--
-- Name: vendor_subscriptions update_vendor_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_vendor_subscriptions_updated_at BEFORE UPDATE ON public.vendor_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_vendor_updated_at();


--
-- Name: ad_clicks ad_clicks_ad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_clicks
    ADD CONSTRAINT ad_clicks_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES public.advertisements(id) ON DELETE CASCADE;


--
-- Name: ad_clicks ad_clicks_impression_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_clicks
    ADD CONSTRAINT ad_clicks_impression_id_fkey FOREIGN KEY (impression_id) REFERENCES public.ad_impressions(id);


--
-- Name: ad_impressions ad_impressions_ad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ad_impressions
    ADD CONSTRAINT ad_impressions_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES public.advertisements(id) ON DELETE CASCADE;


--
-- Name: advertisements advertisements_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advertisements
    ADD CONSTRAINT advertisements_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.vendor_subscriptions(id) ON DELETE CASCADE;


--
-- Name: advertisements advertisements_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.advertisements
    ADD CONSTRAINT advertisements_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendor_profiles(id) ON DELETE CASCADE;


--
-- Name: agent_buyer_coverage_areas agent_buyer_coverage_areas_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_buyer_coverage_areas
    ADD CONSTRAINT agent_buyer_coverage_areas_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent_profiles(id) ON DELETE CASCADE;


--
-- Name: agent_county_preferences agent_county_preferences_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_county_preferences
    ADD CONSTRAINT agent_county_preferences_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent_profiles(id) ON DELETE CASCADE;


--
-- Name: agent_county_preferences agent_county_preferences_county_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_county_preferences
    ADD CONSTRAINT agent_county_preferences_county_id_fkey FOREIGN KEY (county_id) REFERENCES public.counties(id) ON DELETE CASCADE;


--
-- Name: agent_invites agent_invites_accepted_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_invites
    ADD CONSTRAINT agent_invites_accepted_user_id_fkey FOREIGN KEY (accepted_user_id) REFERENCES auth.users(id);


--
-- Name: agent_invites agent_invites_inviter_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_invites
    ADD CONSTRAINT agent_invites_inviter_user_id_fkey FOREIGN KEY (inviter_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_match_deliveries agent_match_deliveries_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_match_deliveries
    ADD CONSTRAINT agent_match_deliveries_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_match_deliveries agent_match_deliveries_hot_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_match_deliveries
    ADD CONSTRAINT agent_match_deliveries_hot_sheet_id_fkey FOREIGN KEY (hot_sheet_id) REFERENCES public.hot_sheets(id) ON DELETE SET NULL;


--
-- Name: agent_match_deliveries agent_match_deliveries_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_match_deliveries
    ADD CONSTRAINT agent_match_deliveries_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.agent_match_submissions(id) ON DELETE CASCADE;


--
-- Name: agent_match_submissions agent_match_submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_match_submissions
    ADD CONSTRAINT agent_match_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: agent_messages agent_messages_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_messages
    ADD CONSTRAINT agent_messages_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: agent_profiles agent_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_profiles
    ADD CONSTRAINT agent_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_proposal_incentives agent_proposal_incentives_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_proposal_incentives
    ADD CONSTRAINT agent_proposal_incentives_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent_profiles(id) ON DELETE CASCADE;


--
-- Name: agent_settings agent_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_settings
    ADD CONSTRAINT agent_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agent_state_preferences agent_state_preferences_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_state_preferences
    ADD CONSTRAINT agent_state_preferences_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: buyer_credentials buyer_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_credentials
    ADD CONSTRAINT buyer_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: buyer_credentials buyer_credentials_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_credentials
    ADD CONSTRAINT buyer_credentials_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id);


--
-- Name: client_needs buyer_needs_county_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_needs
    ADD CONSTRAINT buyer_needs_county_id_fkey FOREIGN KEY (county_id) REFERENCES public.counties(id) ON DELETE CASCADE;


--
-- Name: client_needs buyer_needs_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_needs
    ADD CONSTRAINT buyer_needs_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.agent_profiles(id) ON DELETE CASCADE;


--
-- Name: buyer_qualifications buyer_qualifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_qualifications
    ADD CONSTRAINT buyer_qualifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: buyer_workspace_invites buyer_workspace_invites_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_workspace_invites
    ADD CONSTRAINT buyer_workspace_invites_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent_profiles(id) ON DELETE SET NULL;


--
-- Name: buyer_workspace_invites buyer_workspace_invites_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_workspace_invites
    ADD CONSTRAINT buyer_workspace_invites_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.buyer_workspaces(id) ON DELETE CASCADE;


--
-- Name: buyer_workspace_members buyer_workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_workspace_members
    ADD CONSTRAINT buyer_workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: buyer_workspace_members buyer_workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_workspace_members
    ADD CONSTRAINT buyer_workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.buyer_workspaces(id) ON DELETE CASCADE;


--
-- Name: buyer_workspaces buyer_workspaces_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyer_workspaces
    ADD CONSTRAINT buyer_workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: client_agent_messages client_agent_messages_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_agent_messages
    ADD CONSTRAINT client_agent_messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_agent_relationships client_agent_relationships_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_agent_relationships
    ADD CONSTRAINT client_agent_relationships_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: client_agent_relationships client_agent_relationships_crm_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_agent_relationships
    ADD CONSTRAINT client_agent_relationships_crm_client_id_fkey FOREIGN KEY (crm_client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: client_agent_relationships client_agent_relationships_invitation_token_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.client_agent_relationships
    ADD CONSTRAINT client_agent_relationships_invitation_token_fkey FOREIGN KEY (invitation_token) REFERENCES public.share_tokens(token);


--
-- Name: clients clients_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversation_messages conversation_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_buyer_need_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_buyer_need_id_fkey FOREIGN KEY (buyer_need_id) REFERENCES public.client_needs(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;


--
-- Name: email_campaigns email_campaigns_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT email_campaigns_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: email_clicks email_clicks_email_send_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_clicks
    ADD CONSTRAINT email_clicks_email_send_id_fkey FOREIGN KEY (email_send_id) REFERENCES public.email_sends(id) ON DELETE CASCADE;


--
-- Name: email_events email_events_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.email_jobs(id) ON DELETE CASCADE;


--
-- Name: email_opens email_opens_email_send_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_opens
    ADD CONSTRAINT email_opens_email_send_id_fkey FOREIGN KEY (email_send_id) REFERENCES public.email_sends(id) ON DELETE CASCADE;


--
-- Name: email_sends email_sends_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_sends
    ADD CONSTRAINT email_sends_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.email_campaigns(id) ON DELETE CASCADE;


--
-- Name: favorite_price_history favorite_price_history_favorite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorite_price_history
    ADD CONSTRAINT favorite_price_history_favorite_id_fkey FOREIGN KEY (favorite_id) REFERENCES public.favorites(id) ON DELETE CASCADE;


--
-- Name: favorite_price_history favorite_price_history_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorite_price_history
    ADD CONSTRAINT favorite_price_history_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_clients hot_sheet_clients_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_clients
    ADD CONSTRAINT hot_sheet_clients_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_clients hot_sheet_clients_hot_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_clients
    ADD CONSTRAINT hot_sheet_clients_hot_sheet_id_fkey FOREIGN KEY (hot_sheet_id) REFERENCES public.hot_sheets(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_comments hot_sheet_comments_hot_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_comments
    ADD CONSTRAINT hot_sheet_comments_hot_sheet_id_fkey FOREIGN KEY (hot_sheet_id) REFERENCES public.hot_sheets(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_comments hot_sheet_comments_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_comments
    ADD CONSTRAINT hot_sheet_comments_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_favorites hot_sheet_favorites_hot_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_favorites
    ADD CONSTRAINT hot_sheet_favorites_hot_sheet_id_fkey FOREIGN KEY (hot_sheet_id) REFERENCES public.hot_sheets(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_favorites hot_sheet_favorites_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_favorites
    ADD CONSTRAINT hot_sheet_favorites_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_listing_status hot_sheet_listing_status_hot_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_listing_status
    ADD CONSTRAINT hot_sheet_listing_status_hot_sheet_id_fkey FOREIGN KEY (hot_sheet_id) REFERENCES public.hot_sheets(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_listing_status hot_sheet_listing_status_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_listing_status
    ADD CONSTRAINT hot_sheet_listing_status_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_notifications hot_sheet_notifications_hot_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_notifications
    ADD CONSTRAINT hot_sheet_notifications_hot_sheet_id_fkey FOREIGN KEY (hot_sheet_id) REFERENCES public.hot_sheets(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_notifications hot_sheet_notifications_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_notifications
    ADD CONSTRAINT hot_sheet_notifications_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_notifications hot_sheet_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_notifications
    ADD CONSTRAINT hot_sheet_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_sent_listings hot_sheet_sent_listings_hot_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_sent_listings
    ADD CONSTRAINT hot_sheet_sent_listings_hot_sheet_id_fkey FOREIGN KEY (hot_sheet_id) REFERENCES public.hot_sheets(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_sent_listings hot_sheet_sent_listings_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_sent_listings
    ADD CONSTRAINT hot_sheet_sent_listings_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_shares hot_sheet_shares_hot_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_shares
    ADD CONSTRAINT hot_sheet_shares_hot_sheet_id_fkey FOREIGN KEY (hot_sheet_id) REFERENCES public.hot_sheets(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_shares hot_sheet_shares_shared_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_shares
    ADD CONSTRAINT hot_sheet_shares_shared_by_user_id_fkey FOREIGN KEY (shared_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: hot_sheet_subscribers hot_sheet_subscribers_hot_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheet_subscribers
    ADD CONSTRAINT hot_sheet_subscribers_hot_sheet_id_fkey FOREIGN KEY (hot_sheet_id) REFERENCES public.hot_sheets(id) ON DELETE CASCADE;


--
-- Name: hot_sheets hot_sheets_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheets
    ADD CONSTRAINT hot_sheets_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: hot_sheets hot_sheets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hot_sheets
    ADD CONSTRAINT hot_sheets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: invite_events invite_events_email_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invite_events
    ADD CONSTRAINT invite_events_email_job_id_fkey FOREIGN KEY (email_job_id) REFERENCES public.email_jobs(id) ON DELETE SET NULL;


--
-- Name: invite_events invite_events_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invite_events
    ADD CONSTRAINT invite_events_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.share_tokens(id) ON DELETE CASCADE;


--
-- Name: listing_price_history listing_price_history_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_price_history
    ADD CONSTRAINT listing_price_history_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: listing_shares listing_shares_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_shares
    ADD CONSTRAINT listing_shares_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: listing_stats listing_stats_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_stats
    ADD CONSTRAINT listing_stats_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: listing_status_history listing_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_status_history
    ADD CONSTRAINT listing_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: listing_status_history listing_status_history_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_status_history
    ADD CONSTRAINT listing_status_history_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: listing_views listing_views_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_views
    ADD CONSTRAINT listing_views_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: listing_views listing_views_viewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listing_views
    ADD CONSTRAINT listing_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: listings listings_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: listings listings_original_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_original_listing_id_fkey FOREIGN KEY (original_listing_id) REFERENCES public.listings(id);


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: off_market_views off_market_views_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.off_market_views
    ADD CONSTRAINT off_market_views_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: off_market_views off_market_views_viewer_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.off_market_views
    ADD CONSTRAINT off_market_views_viewer_agent_id_fkey FOREIGN KEY (viewer_agent_id) REFERENCES public.agent_profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: saved_searches saved_searches_buyer_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_searches
    ADD CONSTRAINT saved_searches_buyer_workspace_id_fkey FOREIGN KEY (buyer_workspace_id) REFERENCES public.buyer_workspaces(id) ON DELETE CASCADE;


--
-- Name: saved_searches saved_searches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saved_searches
    ADD CONSTRAINT saved_searches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: seller_match_outcomes seller_match_outcomes_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_match_outcomes
    ADD CONSTRAINT seller_match_outcomes_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.seller_matches(id) ON DELETE CASCADE;


--
-- Name: seller_match_outcomes seller_match_outcomes_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_match_outcomes
    ADD CONSTRAINT seller_match_outcomes_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: seller_matches seller_matches_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_matches
    ADD CONSTRAINT seller_matches_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: seller_matches seller_matches_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_matches
    ADD CONSTRAINT seller_matches_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.agent_match_deliveries(id) ON DELETE SET NULL;


--
-- Name: seller_matches seller_matches_hot_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_matches
    ADD CONSTRAINT seller_matches_hot_sheet_id_fkey FOREIGN KEY (hot_sheet_id) REFERENCES public.hot_sheets(id) ON DELETE SET NULL;


--
-- Name: seller_matches seller_matches_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_matches
    ADD CONSTRAINT seller_matches_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.agent_match_submissions(id) ON DELETE CASCADE;


--
-- Name: share_tokens share_tokens_accepted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.share_tokens
    ADD CONSTRAINT share_tokens_accepted_by_user_id_fkey FOREIGN KEY (accepted_by_user_id) REFERENCES auth.users(id);


--
-- Name: share_tokens share_tokens_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.share_tokens
    ADD CONSTRAINT share_tokens_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent_profiles(id) ON DELETE CASCADE;


--
-- Name: showing_requests showing_requests_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.showing_requests
    ADD CONSTRAINT showing_requests_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent_profiles(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams teams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: testimonials testimonials_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agent_profiles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vendor_profiles vendor_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_profiles
    ADD CONSTRAINT vendor_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vendor_subscriptions vendor_subscriptions_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_subscriptions
    ADD CONSTRAINT vendor_subscriptions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.ad_packages(id);


--
-- Name: vendor_subscriptions vendor_subscriptions_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendor_subscriptions
    ADD CONSTRAINT vendor_subscriptions_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendor_profiles(id) ON DELETE CASCADE;


--
-- Name: seller_matches Admin can delete seller matches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can delete seller matches" ON public.seller_matches FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: seller_match_outcomes Admin can insert seller match outcomes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can insert seller match outcomes" ON public.seller_match_outcomes FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: seller_matches Admin can insert seller matches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can insert seller matches" ON public.seller_matches FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: seller_matches Admin can update seller matches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can update seller matches" ON public.seller_matches FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: seller_match_outcomes Admin can view all seller match outcomes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can view all seller match outcomes" ON public.seller_match_outcomes FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: seller_matches Admin can view all seller matches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admin can view all seller matches" ON public.seller_matches FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_buyer_coverage_areas Admins can delete agent buyer coverage areas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete agent buyer coverage areas" ON public.agent_buyer_coverage_areas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_county_preferences Admins can delete agent county preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete agent county preferences" ON public.agent_county_preferences FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_profiles Admins can delete agent profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete agent profiles" ON public.agent_profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_settings Admins can delete agent settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete agent settings" ON public.agent_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_state_preferences Admins can delete agent state preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete agent state preferences" ON public.agent_state_preferences FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: listings Admins can delete any listing; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete any listing" ON public.listings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: clients Admins can delete clients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete clients" ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: email_templates Admins can delete email templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete email templates" ON public.email_templates FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: favorites Admins can delete favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete favorites" ON public.favorites FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: deleted_users Admins can delete from archive; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete from archive" ON public.deleted_users FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: hot_sheets Admins can delete hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete hot sheets" ON public.hot_sheets FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: listing_drafts Admins can delete listing drafts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete listing drafts" ON public.listing_drafts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: notification_preferences Admins can delete notification preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete notification preferences" ON public.notification_preferences FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can delete profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_early_access Admins can delete registrations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete registrations" ON public.agent_early_access FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: testimonials Admins can delete testimonials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete testimonials" ON public.testimonials FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can delete user roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_settings Admins can insert agent settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert agent settings" ON public.agent_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: deleted_users Admins can insert deleted users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert deleted users" ON public.deleted_users FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: buyer_qualifications Admins can manage buyer qualifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage buyer qualifications" ON public.buyer_qualifications USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: feature_flags Admins can manage feature flags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage feature flags" ON public.feature_flags USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_proposal_incentives Admins can manage proposal incentives; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage proposal incentives" ON public.agent_proposal_incentives USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_settings Admins can read all agent settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can read all agent settings" ON public.agent_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: invite_events Admins can read all invite events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can read all invite events" ON public.invite_events FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_settings Admins can update all agent settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update all agent settings" ON public.agent_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_license_uploads Admins can update license uploads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update license uploads" ON public.agent_license_uploads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pending_verifications Admins can update pending verifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update pending verifications" ON public.pending_verifications FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_early_access Admins can update registrations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update registrations" ON public.agent_early_access FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: clients Admins can view all clients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all clients" ON public.clients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pending_verifications Admins can view all pending verifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all pending verifications" ON public.pending_verifications FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: agent_early_access Admins can view all registrations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all registrations" ON public.agent_early_access FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all user roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all user roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: deleted_users Admins can view deleted users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view deleted users" ON public.deleted_users FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: hot_sheet_comments Agents and clients can view comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents and clients can view comments" ON public.hot_sheet_comments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_comments.hot_sheet_id) AND ((hot_sheets.user_id = auth.uid()) OR true)))));


--
-- Name: email_campaigns Agents can create campaigns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can create campaigns" ON public.email_campaigns FOR INSERT WITH CHECK ((auth.uid() = agent_id));


--
-- Name: share_tokens Agents can create their own tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can create their own tokens" ON public.share_tokens FOR INSERT TO authenticated WITH CHECK ((auth.uid() = agent_id));


--
-- Name: clients Agents can delete their own clients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can delete their own clients" ON public.clients FOR DELETE USING ((auth.uid() = agent_id));


--
-- Name: agent_county_preferences Agents can delete their own county preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can delete their own county preferences" ON public.agent_county_preferences FOR DELETE USING ((auth.uid() = agent_id));


--
-- Name: agent_buyer_coverage_areas Agents can delete their own coverage areas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can delete their own coverage areas" ON public.agent_buyer_coverage_areas FOR DELETE USING ((auth.uid() = agent_id));


--
-- Name: listings Agents can delete their own draft listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can delete their own draft listings" ON public.listings FOR DELETE USING (((auth.uid() = agent_id) AND (status = 'draft'::text)));


--
-- Name: listings Agents can delete their own listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can delete their own listings" ON public.listings FOR DELETE USING ((auth.uid() = agent_id));


--
-- Name: agent_state_preferences Agents can delete their own state preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can delete their own state preferences" ON public.agent_state_preferences FOR DELETE USING ((auth.uid() = agent_id));


--
-- Name: email_templates Agents can delete their own templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can delete their own templates" ON public.email_templates FOR DELETE USING (((auth.uid() = agent_id) AND (is_default = false)));


--
-- Name: testimonials Agents can delete their own testimonials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can delete their own testimonials" ON public.testimonials FOR DELETE USING ((auth.uid() = agent_id));


--
-- Name: share_tokens Agents can delete their own tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can delete their own tokens" ON public.share_tokens FOR DELETE TO authenticated USING ((auth.uid() = agent_id));


--
-- Name: agent_proposal_incentives Agents can insert own incentives; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can insert own incentives" ON public.agent_proposal_incentives FOR INSERT WITH CHECK ((auth.uid() = agent_id));


--
-- Name: agent_license_uploads Agents can insert own license uploads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can insert own license uploads" ON public.agent_license_uploads FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: clients Agents can insert their own clients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can insert their own clients" ON public.clients FOR INSERT WITH CHECK ((auth.uid() = agent_id));


--
-- Name: agent_county_preferences Agents can insert their own county preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can insert their own county preferences" ON public.agent_county_preferences FOR INSERT WITH CHECK ((auth.uid() = agent_id));


--
-- Name: agent_buyer_coverage_areas Agents can insert their own coverage areas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can insert their own coverage areas" ON public.agent_buyer_coverage_areas FOR INSERT WITH CHECK ((auth.uid() = agent_id));


--
-- Name: agent_profiles Agents can insert their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can insert their own profile" ON public.agent_profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: agent_state_preferences Agents can insert their own state preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can insert their own state preferences" ON public.agent_state_preferences FOR INSERT WITH CHECK ((auth.uid() = agent_id));


--
-- Name: email_templates Agents can insert their own templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can insert their own templates" ON public.email_templates FOR INSERT WITH CHECK (((auth.uid() = agent_id) AND (is_default = false)));


--
-- Name: testimonials Agents can insert their own testimonials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can insert their own testimonials" ON public.testimonials FOR INSERT WITH CHECK ((auth.uid() = agent_id));


--
-- Name: agent_proposal_incentives Agents can read own incentives; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can read own incentives" ON public.agent_proposal_incentives FOR SELECT USING ((auth.uid() = agent_id));


--
-- Name: agent_license_uploads Agents can read own license uploads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can read own license uploads" ON public.agent_license_uploads FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: invite_events Agents can read their own invite events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can read their own invite events" ON public.invite_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.share_tokens st
  WHERE ((st.id = invite_events.token_id) AND (st.agent_id = auth.uid())))));


--
-- Name: off_market_views Agents can record their views; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can record their views" ON public.off_market_views FOR INSERT WITH CHECK ((viewer_agent_id = auth.uid()));


--
-- Name: agent_proposal_incentives Agents can update own incentives; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can update own incentives" ON public.agent_proposal_incentives FOR UPDATE USING ((auth.uid() = agent_id)) WITH CHECK ((auth.uid() = agent_id));


--
-- Name: agent_notifications Agents can update own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can update own notifications" ON public.agent_notifications FOR UPDATE USING ((auth.uid() = agent_id));


--
-- Name: showing_requests Agents can update showing requests for their listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can update showing requests for their listings" ON public.showing_requests FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.listings
  WHERE ((listings.id = showing_requests.listing_id) AND (listings.agent_id = auth.uid())))));


--
-- Name: conversations Agents can update their conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can update their conversations" ON public.conversations FOR UPDATE USING (((auth.uid() = agent_a_id) OR (auth.uid() = agent_b_id)));


--
-- Name: clients Agents can update their own clients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can update their own clients" ON public.clients FOR UPDATE USING ((auth.uid() = agent_id));


--
-- Name: agent_profiles Agents can update their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can update their own profile" ON public.agent_profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: email_templates Agents can update their own templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can update their own templates" ON public.email_templates FOR UPDATE USING (((auth.uid() = agent_id) AND (is_default = false)));


--
-- Name: testimonials Agents can update their own testimonials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can update their own testimonials" ON public.testimonials FOR UPDATE USING ((auth.uid() = agent_id));


--
-- Name: share_tokens Agents can update their own tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can update their own tokens" ON public.share_tokens FOR UPDATE TO authenticated USING (((auth.uid() = agent_id) AND (accepted_by_user_id IS NULL) AND (accepted_at IS NULL)));


--
-- Name: buyer_credentials Agents can view buyer credentials in context; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view buyer credentials in context" ON public.buyer_credentials FOR SELECT TO authenticated USING (((verification_status = 'verified'::text) AND (expires_at > CURRENT_DATE)));


--
-- Name: email_clicks Agents can view clicks from their campaigns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view clicks from their campaigns" ON public.email_clicks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.email_sends es
     JOIN public.email_campaigns ec ON ((ec.id = es.campaign_id)))
  WHERE ((es.id = email_clicks.email_send_id) AND (ec.agent_id = auth.uid())))));


--
-- Name: conversation_messages Agents can view messages in their conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view messages in their conversations" ON public.conversation_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_messages.conversation_id) AND ((c.agent_a_id = auth.uid()) OR (c.agent_b_id = auth.uid()))))));


--
-- Name: client_agent_messages Agents can view messages sent to them; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view messages sent to them" ON public.client_agent_messages FOR SELECT TO authenticated USING ((agent_id = auth.uid()));


--
-- Name: email_opens Agents can view opens from their campaigns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view opens from their campaigns" ON public.email_opens FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.email_sends es
     JOIN public.email_campaigns ec ON ((ec.id = es.campaign_id)))
  WHERE ((es.id = email_opens.email_send_id) AND (ec.agent_id = auth.uid())))));


--
-- Name: agent_notifications Agents can view own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view own notifications" ON public.agent_notifications FOR SELECT USING ((auth.uid() = agent_id));


--
-- Name: listing_price_history Agents can view price history for their listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view price history for their listings" ON public.listing_price_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.listings
  WHERE ((listings.id = listing_price_history.listing_id) AND (listings.agent_id = auth.uid())))));


--
-- Name: email_sends Agents can view sends from their campaigns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view sends from their campaigns" ON public.email_sends FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.email_campaigns
  WHERE ((email_campaigns.id = email_sends.campaign_id) AND (email_campaigns.agent_id = auth.uid())))));


--
-- Name: hot_sheet_sent_listings Agents can view sent listings for their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view sent listings for their hot sheets" ON public.hot_sheet_sent_listings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_sent_listings.hot_sheet_id) AND (hot_sheets.user_id = auth.uid())))));


--
-- Name: listing_shares Agents can view shares for their listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view shares for their listings" ON public.listing_shares FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.listings
  WHERE ((listings.id = listing_shares.listing_id) AND (listings.agent_id = auth.uid())))));


--
-- Name: showing_requests Agents can view showing requests for their listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view showing requests for their listings" ON public.showing_requests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.listings
  WHERE ((listings.id = showing_requests.listing_id) AND (listings.agent_id = auth.uid())))));


--
-- Name: listing_status_history Agents can view status history for their listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view status history for their listings" ON public.listing_status_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.listings
  WHERE ((listings.id = listing_status_history.listing_id) AND (listings.agent_id = auth.uid())))));


--
-- Name: client_agent_relationships Agents can view their agent relationships; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their agent relationships" ON public.client_agent_relationships FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agent_profiles
  WHERE ((agent_profiles.id = client_agent_relationships.agent_id) AND (agent_profiles.id = auth.uid())))));


--
-- Name: conversations Agents can view their conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their conversations" ON public.conversations FOR SELECT USING (((auth.uid() = agent_a_id) OR (auth.uid() = agent_b_id)));


--
-- Name: agent_match_deliveries Agents can view their deliveries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their deliveries" ON public.agent_match_deliveries FOR SELECT USING ((auth.uid() = agent_id));


--
-- Name: listing_views Agents can view their listing views; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their listing views" ON public.listing_views FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.listings
  WHERE ((listings.id = listing_views.listing_id) AND (listings.agent_id = auth.uid())))));


--
-- Name: email_campaigns Agents can view their own campaigns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their own campaigns" ON public.email_campaigns FOR SELECT USING ((auth.uid() = agent_id));


--
-- Name: clients Agents can view their own clients; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their own clients" ON public.clients FOR SELECT USING ((auth.uid() = agent_id));


--
-- Name: agent_buyer_coverage_areas Agents can view their own coverage areas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their own coverage areas" ON public.agent_buyer_coverage_areas FOR SELECT USING ((auth.uid() = agent_id));


--
-- Name: agent_messages Agents can view their own messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their own messages" ON public.agent_messages FOR SELECT USING ((auth.uid() = agent_id));


--
-- Name: agent_state_preferences Agents can view their own state preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their own state preferences" ON public.agent_state_preferences FOR SELECT USING ((auth.uid() = agent_id));


--
-- Name: email_templates Agents can view their own templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their own templates" ON public.email_templates FOR SELECT USING (((auth.uid() = agent_id) OR (is_default = true)));


--
-- Name: testimonials Agents can view their own testimonials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their own testimonials" ON public.testimonials FOR SELECT USING ((auth.uid() = agent_id));


--
-- Name: share_tokens Agents can view their own tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view their own tokens" ON public.share_tokens FOR SELECT TO authenticated USING ((auth.uid() = agent_id));


--
-- Name: off_market_views Agents can view views on their listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can view views on their listings" ON public.off_market_views FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.listings
  WHERE ((listings.id = off_market_views.listing_id) AND (listings.agent_id = auth.uid())))));


--
-- Name: hot_sheet_subscribers Agents manage subscribers for their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents manage subscribers for their hot sheets" ON public.hot_sheet_subscribers TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.hot_sheets hs
  WHERE ((hs.id = hot_sheet_subscribers.hot_sheet_id) AND (hs.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.hot_sheets hs
  WHERE ((hs.id = hot_sheet_subscribers.hot_sheet_id) AND (hs.user_id = auth.uid())))));


--
-- Name: client_needs All authenticated users can view client needs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "All authenticated users can view client needs" ON public.client_needs FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: hot_sheet_comments Anyone can add comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can add comments" ON public.hot_sheet_comments FOR INSERT WITH CHECK (true);


--
-- Name: hot_sheet_favorites Anyone can add favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can add favorites" ON public.hot_sheet_favorites FOR INSERT WITH CHECK (true);


--
-- Name: showing_requests Anyone can create showing requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can create showing requests" ON public.showing_requests FOR INSERT WITH CHECK (true);


--
-- Name: agent_match_submissions Anyone can create submissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can create submissions" ON public.agent_match_submissions FOR INSERT WITH CHECK (true);


--
-- Name: hot_sheet_comments Anyone can delete their comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can delete their comments" ON public.hot_sheet_comments FOR DELETE USING (true);


--
-- Name: listing_price_history Anyone can insert price history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can insert price history" ON public.listing_price_history FOR INSERT WITH CHECK (true);


--
-- Name: listing_shares Anyone can insert shares; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can insert shares" ON public.listing_shares FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: listing_views Anyone can record views; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can record views" ON public.listing_views FOR INSERT WITH CHECK (true);


--
-- Name: agent_early_access Anyone can register for early access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can register for early access" ON public.agent_early_access FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: hot_sheet_favorites Anyone can remove favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can remove favorites" ON public.hot_sheet_favorites FOR DELETE USING (true);


--
-- Name: agent_messages Anyone can send messages to agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can send messages to agents" ON public.agent_messages FOR INSERT WITH CHECK (true);


--
-- Name: coming_soon_signups Anyone can signup for updates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can signup for updates" ON public.coming_soon_signups FOR INSERT WITH CHECK (true);


--
-- Name: hot_sheet_comments Anyone can update their comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can update their comments" ON public.hot_sheet_comments FOR UPDATE USING (true);


--
-- Name: share_tokens Anyone can validate tokens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can validate tokens" ON public.share_tokens FOR SELECT TO authenticated, anon USING (true);


--
-- Name: ad_packages Anyone can view active ad packages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view active ad packages" ON public.ad_packages FOR SELECT USING ((is_active = true));


--
-- Name: advertisements Anyone can view active ads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view active ads" ON public.advertisements FOR SELECT USING ((is_active = true));


--
-- Name: agent_county_preferences Anyone can view agent county preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view agent county preferences" ON public.agent_county_preferences FOR SELECT USING (true);


--
-- Name: agent_profiles Anyone can view agent profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view agent profiles" ON public.agent_profiles FOR SELECT USING (true);


--
-- Name: agent_state_preferences Anyone can view all agent state preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view all agent state preferences" ON public.agent_state_preferences FOR SELECT USING (true);


--
-- Name: testimonials Anyone can view all testimonials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view all testimonials" ON public.testimonials FOR SELECT USING (true);


--
-- Name: vendor_profiles Anyone can view approved vendor profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view approved vendor profiles" ON public.vendor_profiles FOR SELECT USING (((is_approved = true) AND (is_active = true)));


--
-- Name: agent_buyer_coverage_areas Anyone can view coverage areas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view coverage areas" ON public.agent_buyer_coverage_areas FOR SELECT USING (true);


--
-- Name: hot_sheet_favorites Anyone can view favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view favorites" ON public.hot_sheet_favorites FOR SELECT USING (true);


--
-- Name: hot_sheets Anyone can view hot sheets with valid token; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view hot sheets with valid token" ON public.hot_sheets FOR SELECT USING (true);


--
-- Name: listing_stats Anyone can view listing stats; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view listing stats" ON public.listing_stats FOR SELECT USING (true);


--
-- Name: public_records_cache Anyone can view public records cache; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view public records cache" ON public.public_records_cache FOR SELECT USING (true);


--
-- Name: listings Anyone can view published listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view published listings" ON public.listings FOR SELECT USING (((status = ANY (ARRAY['active'::text, 'new'::text, 'coming_soon'::text, 'off_market'::text, 'back_on_market'::text, 'price_changed'::text, 'extended'::text, 'reactivated'::text, 'under_agreement'::text, 'pending'::text, 'contingent'::text, 'sold'::text, 'rented'::text])) OR (auth.uid() = agent_id)));


--
-- Name: team_members Anyone can view team members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view team members" ON public.team_members FOR SELECT USING (true);


--
-- Name: teams Anyone can view teams; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);


--
-- Name: hot_sheet_listing_status Anyone with token can delete status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone with token can delete status" ON public.hot_sheet_listing_status FOR DELETE USING (true);


--
-- Name: hot_sheet_listing_status Anyone with token can insert status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone with token can insert status" ON public.hot_sheet_listing_status FOR INSERT WITH CHECK (true);


--
-- Name: hot_sheet_listing_status Anyone with token can update status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone with token can update status" ON public.hot_sheet_listing_status FOR UPDATE USING (true);


--
-- Name: hot_sheet_listing_status Anyone with token can view status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone with token can view status" ON public.hot_sheet_listing_status FOR SELECT USING (true);


--
-- Name: client_agent_messages Buyers can message their agent; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Buyers can message their agent" ON public.client_agent_messages FOR INSERT TO authenticated WITH CHECK (((sender_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.clients c
     JOIN public.profiles p ON ((lower(c.email) = lower(p.email))))
  WHERE ((c.id = client_agent_messages.client_id) AND (p.id = auth.uid()) AND (c.agent_id = c.agent_id))))));


--
-- Name: client_agent_messages Buyers can view their sent messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Buyers can view their sent messages" ON public.client_agent_messages FOR SELECT TO authenticated USING (((sender_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.clients c
     JOIN public.profiles p ON ((lower(c.email) = lower(p.email))))
  WHERE ((c.id = client_agent_messages.client_id) AND (p.id = auth.uid()) AND (c.agent_id = c.agent_id))))));


--
-- Name: share_tokens Clients can accept tokens via email; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clients can accept tokens via email" ON public.share_tokens FOR UPDATE TO authenticated USING (((accepted_by_user_id IS NULL) AND ((payload ->> 'type'::text) = 'client_hotsheet_invite'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.email) = lower((share_tokens.payload ->> 'client_email'::text)))))))) WITH CHECK ((accepted_by_user_id = auth.uid()));


--
-- Name: hot_sheet_clients Clients can view their hot sheet links; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clients can view their hot sheet links" ON public.hot_sheet_clients FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.clients c
     JOIN public.profiles p ON ((lower(c.email) = lower(p.email))))
  WHERE ((c.id = hot_sheet_clients.client_id) AND (p.id = auth.uid())))));


--
-- Name: client_agent_relationships Clients can view their own relationships; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Clients can view their own relationships" ON public.client_agent_relationships FOR SELECT TO authenticated USING ((auth.uid() = client_id));


--
-- Name: counties Counties are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Counties are viewable by everyone" ON public.counties FOR SELECT USING (true);


--
-- Name: buyer_workspaces Members can view workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can view workspace" ON public.buyer_workspaces FOR SELECT TO authenticated USING (public.is_buyer_workspace_member(id));


--
-- Name: buyer_workspace_members Members can view workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can view workspace members" ON public.buyer_workspace_members FOR SELECT TO authenticated USING (public.is_buyer_workspace_member(workspace_id));


--
-- Name: buyer_workspace_members Owner can delete workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owner can delete workspace members" ON public.buyer_workspace_members FOR DELETE TO authenticated USING (public.is_buyer_workspace_owner(workspace_id));


--
-- Name: buyer_workspace_members Owner can insert workspace members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owner can insert workspace members" ON public.buyer_workspace_members FOR INSERT TO authenticated WITH CHECK (public.is_buyer_workspace_owner(workspace_id));


--
-- Name: buyer_workspaces Owner can update workspace; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owner can update workspace" ON public.buyer_workspaces FOR UPDATE TO authenticated USING (public.is_buyer_workspace_owner(id));


--
-- Name: team_members Owners can delete members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can delete members" ON public.team_members FOR DELETE USING (public.is_team_owner(team_id, auth.uid()));


--
-- Name: team_members Owners can insert members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can insert members" ON public.team_members FOR INSERT WITH CHECK (public.is_team_owner(team_id, auth.uid()));


--
-- Name: team_members Owners can update members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can update members" ON public.team_members FOR UPDATE USING (public.is_team_owner(team_id, auth.uid())) WITH CHECK (public.is_team_owner(team_id, auth.uid()));


--
-- Name: email_clicks Public can insert clicks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can insert clicks" ON public.email_clicks FOR INSERT WITH CHECK (true);


--
-- Name: email_opens Public can insert opens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can insert opens" ON public.email_opens FOR INSERT WITH CHECK (true);


--
-- Name: conversation_messages Recipients can mark messages as read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Recipients can mark messages as read" ON public.conversation_messages FOR UPDATE TO authenticated USING ((auth.uid() = recipient_agent_id)) WITH CHECK ((auth.uid() = recipient_agent_id));


--
-- Name: invite_events Service role can insert invite events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can insert invite events" ON public.invite_events FOR INSERT WITH CHECK (true);


--
-- Name: audit_logs System can insert audit logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: agent_match_deliveries System can insert deliveries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert deliveries" ON public.agent_match_deliveries FOR INSERT WITH CHECK (true);


--
-- Name: email_sends System can insert email sends; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert email sends" ON public.email_sends FOR INSERT WITH CHECK (true);


--
-- Name: public_records_cache System can insert public records cache; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert public records cache" ON public.public_records_cache FOR INSERT WITH CHECK (true);


--
-- Name: hot_sheet_sent_listings System can insert sent listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert sent listings" ON public.hot_sheet_sent_listings FOR INSERT WITH CHECK (true);


--
-- Name: listing_status_history System can insert status history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert status history" ON public.listing_status_history FOR INSERT WITH CHECK (true);


--
-- Name: user_roles System can insert user roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert user roles" ON public.user_roles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: listing_stats System can manage listing stats; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can manage listing stats" ON public.listing_stats USING (true) WITH CHECK (true);


--
-- Name: ad_clicks System can record clicks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can record clicks" ON public.ad_clicks FOR INSERT WITH CHECK (true);


--
-- Name: ad_impressions System can record impressions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can record impressions" ON public.ad_impressions FOR INSERT WITH CHECK (true);


--
-- Name: team_members Team creators can add themselves as members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Team creators can add themselves as members" ON public.team_members FOR INSERT WITH CHECK (((auth.uid() = agent_id) AND (EXISTS ( SELECT 1
   FROM public.teams
  WHERE ((teams.id = team_members.team_id) AND (teams.created_by = auth.uid()))))));


--
-- Name: teams Team creators can insert their own teams; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Team creators can insert their own teams" ON public.teams FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: teams Team owners can delete their teams; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Team owners can delete their teams" ON public.teams FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.team_members
  WHERE ((team_members.team_id = teams.id) AND (team_members.agent_id = auth.uid()) AND (team_members.role = 'owner'::text)))));


--
-- Name: teams Team owners can update their teams; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Team owners can update their teams" ON public.teams FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.team_members
  WHERE ((team_members.team_id = teams.id) AND (team_members.agent_id = auth.uid()) AND (team_members.role = 'owner'::text)))));


--
-- Name: hot_sheet_clients Users can add clients to their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can add clients to their hot sheets" ON public.hot_sheet_clients FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_clients.hot_sheet_id) AND (hot_sheets.user_id = auth.uid())))));


--
-- Name: favorites Users can add their own favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can add their own favorites" ON public.favorites FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: client_agent_relationships Users can create relationships; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create relationships" ON public.client_agent_relationships FOR INSERT TO authenticated WITH CHECK ((auth.uid() = client_id));


--
-- Name: hot_sheet_shares Users can create shares for their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create shares for their hot sheets" ON public.hot_sheet_shares FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_shares.hot_sheet_id) AND (hot_sheets.user_id = auth.uid())))));


--
-- Name: hot_sheets Users can create their own hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create their own hot sheets" ON public.hot_sheets FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: notification_preferences Users can create their own notification preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create their own notification preferences" ON public.notification_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: hot_sheet_shares Users can delete shares for their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete shares for their hot sheets" ON public.hot_sheet_shares FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_shares.hot_sheet_id) AND (hot_sheets.user_id = auth.uid())))));


--
-- Name: hot_sheet_listing_status Users can delete status for their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete status for their hot sheets" ON public.hot_sheet_listing_status FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_listing_status.hot_sheet_id) AND (hot_sheets.user_id = auth.uid())))));


--
-- Name: buyer_credentials Users can delete their own credentials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own credentials" ON public.buyer_credentials FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: listing_drafts Users can delete their own drafts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own drafts" ON public.listing_drafts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: hot_sheets Users can delete their own hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own hot sheets" ON public.hot_sheets FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: agent_settings Users can insert own settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own settings" ON public.agent_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: hot_sheet_listing_status Users can insert status for their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert status for their hot sheets" ON public.hot_sheet_listing_status FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_listing_status.hot_sheet_id) AND (hot_sheets.user_id = auth.uid())))));


--
-- Name: buyer_credentials Users can insert their own credentials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own credentials" ON public.buyer_credentials FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: listing_drafts Users can insert their own drafts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own drafts" ON public.listing_drafts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: pending_verifications Users can insert their own pending verification; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own pending verification" ON public.pending_verifications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: agent_settings Users can read own settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own settings" ON public.agent_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: hot_sheet_clients Users can remove clients from their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can remove clients from their hot sheets" ON public.hot_sheet_clients FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_clients.hot_sheet_id) AND (hot_sheets.user_id = auth.uid())))));


--
-- Name: favorites Users can remove their own favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can remove their own favorites" ON public.favorites FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: agent_settings Users can update own settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own settings" ON public.agent_settings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: hot_sheet_listing_status Users can update status for their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update status for their hot sheets" ON public.hot_sheet_listing_status FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_listing_status.hot_sheet_id) AND (hot_sheets.user_id = auth.uid())))));


--
-- Name: buyer_credentials Users can update their own credentials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own credentials" ON public.buyer_credentials FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: listing_drafts Users can update their own drafts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own drafts" ON public.listing_drafts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: hot_sheets Users can update their own hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own hot sheets" ON public.hot_sheets FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notification_preferences Users can update their own notification preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own notification preferences" ON public.notification_preferences FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: agent_match_submissions Users can update their own submissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own submissions" ON public.agent_match_submissions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: hot_sheet_clients Users can view clients for their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view clients for their hot sheets" ON public.hot_sheet_clients FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_clients.hot_sheet_id) AND (hot_sheets.user_id = auth.uid())))));


--
-- Name: favorite_price_history Users can view price history for their favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view price history for their favorites" ON public.favorite_price_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.favorites
  WHERE ((favorites.id = favorite_price_history.favorite_id) AND (favorites.user_id = auth.uid())))));


--
-- Name: hot_sheet_shares Users can view shares for their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view shares for their hot sheets" ON public.hot_sheet_shares FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_shares.hot_sheet_id) AND (hot_sheets.user_id = auth.uid())))));


--
-- Name: hot_sheet_listing_status Users can view status for their hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view status for their hot sheets" ON public.hot_sheet_listing_status FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.hot_sheets
  WHERE ((hot_sheets.id = hot_sheet_listing_status.hot_sheet_id) AND (hot_sheets.user_id = auth.uid())))));


--
-- Name: audit_logs Users can view their own audit logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own audit logs" ON public.audit_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: buyer_credentials Users can view their own credentials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own credentials" ON public.buyer_credentials FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: listing_drafts Users can view their own drafts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own drafts" ON public.listing_drafts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: favorites Users can view their own favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own favorites" ON public.favorites FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: hot_sheet_notifications Users can view their own hot sheet notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own hot sheet notifications" ON public.hot_sheet_notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: hot_sheets Users can view their own hot sheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own hot sheets" ON public.hot_sheets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notification_preferences Users can view their own notification preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own notification preferences" ON public.notification_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: agent_match_submissions Users can view their own submissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own submissions" ON public.agent_match_submissions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: vendor_profiles Vendors can create their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Vendors can create their own profile" ON public.vendor_profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: vendor_subscriptions Vendors can create their own subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Vendors can create their own subscriptions" ON public.vendor_subscriptions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.vendor_profiles
  WHERE ((vendor_profiles.id = vendor_subscriptions.vendor_id) AND (vendor_profiles.user_id = auth.uid())))));


--
-- Name: advertisements Vendors can manage their own ads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Vendors can manage their own ads" ON public.advertisements USING ((EXISTS ( SELECT 1
   FROM public.vendor_profiles
  WHERE ((vendor_profiles.id = advertisements.vendor_id) AND (vendor_profiles.user_id = auth.uid())))));


--
-- Name: vendor_profiles Vendors can update their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Vendors can update their own profile" ON public.vendor_profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: vendor_subscriptions Vendors can update their own subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Vendors can update their own subscriptions" ON public.vendor_subscriptions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.vendor_profiles
  WHERE ((vendor_profiles.id = vendor_subscriptions.vendor_id) AND (vendor_profiles.user_id = auth.uid())))));


--
-- Name: ad_clicks Vendors can view their ad clicks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Vendors can view their ad clicks" ON public.ad_clicks FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.advertisements
     JOIN public.vendor_profiles ON ((advertisements.vendor_id = vendor_profiles.id)))
  WHERE ((advertisements.id = ad_clicks.ad_id) AND (vendor_profiles.user_id = auth.uid())))));


--
-- Name: ad_impressions Vendors can view their ad impressions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Vendors can view their ad impressions" ON public.ad_impressions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.advertisements
     JOIN public.vendor_profiles ON ((advertisements.vendor_id = vendor_profiles.id)))
  WHERE ((advertisements.id = ad_impressions.ad_id) AND (vendor_profiles.user_id = auth.uid())))));


--
-- Name: vendor_profiles Vendors can view their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Vendors can view their own profile" ON public.vendor_profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: vendor_subscriptions Vendors can view their own subscriptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Vendors can view their own subscriptions" ON public.vendor_subscriptions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.vendor_profiles
  WHERE ((vendor_profiles.id = vendor_subscriptions.vendor_id) AND (vendor_profiles.user_id = auth.uid())))));


--
-- Name: conversations Verified agents can create conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Verified agents can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK ((public.is_verified_agent() AND ((auth.uid() = agent_a_id) OR (auth.uid() = agent_b_id)) AND (agent_a_id <> agent_b_id)));


--
-- Name: listings Verified agents can create listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Verified agents can create listings" ON public.listings FOR INSERT TO authenticated WITH CHECK ((public.is_verified_agent() AND (auth.uid() = agent_id)));


--
-- Name: client_needs Verified agents can insert buyer needs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Verified agents can insert buyer needs" ON public.client_needs FOR INSERT TO authenticated WITH CHECK ((public.is_verified_agent() AND (auth.uid() = submitted_by)));


--
-- Name: conversation_messages Verified agents can send messages in their conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Verified agents can send messages in their conversations" ON public.conversation_messages FOR INSERT TO authenticated WITH CHECK ((public.is_verified_agent() AND (auth.uid() = sender_agent_id) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_messages.conversation_id) AND (((c.agent_a_id = conversation_messages.sender_agent_id) AND (c.agent_b_id = conversation_messages.recipient_agent_id)) OR ((c.agent_b_id = conversation_messages.sender_agent_id) AND (c.agent_a_id = conversation_messages.recipient_agent_id))))))));


--
-- Name: listings Verified agents can update their listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Verified agents can update their listings" ON public.listings FOR UPDATE TO authenticated USING ((auth.uid() = agent_id)) WITH CHECK ((public.is_verified_agent() AND (auth.uid() = agent_id)));


--
-- Name: agent_match_submissions Verified agents can view matched submissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Verified agents can view matched submissions" ON public.agent_match_submissions FOR SELECT USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.agent_match_deliveries d
  WHERE ((d.submission_id = agent_match_submissions.id) AND (d.agent_id = auth.uid()))))));


--
-- Name: saved_searches Workspace members can delete saved searches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace members can delete saved searches" ON public.saved_searches FOR DELETE TO authenticated USING (public.is_buyer_workspace_member(buyer_workspace_id));


--
-- Name: saved_searches Workspace members can insert saved searches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace members can insert saved searches" ON public.saved_searches FOR INSERT TO authenticated WITH CHECK (public.is_buyer_workspace_member(buyer_workspace_id));


--
-- Name: saved_searches Workspace members can view saved searches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace members can view saved searches" ON public.saved_searches FOR SELECT TO authenticated USING (public.is_buyer_workspace_member(buyer_workspace_id));


--
-- Name: buyer_workspace_invites Workspace owners can create invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace owners can create invites" ON public.buyer_workspace_invites FOR INSERT TO authenticated WITH CHECK ((public.is_buyer_workspace_owner(workspace_id) AND (created_by_user_id = auth.uid())));


--
-- Name: buyer_workspace_invites Workspace owners can delete pending invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace owners can delete pending invites" ON public.buyer_workspace_invites FOR DELETE TO authenticated USING ((public.is_buyer_workspace_owner(workspace_id) AND (accepted_at IS NULL)));


--
-- Name: buyer_workspace_invites Workspace owners can view invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Workspace owners can view invites" ON public.buyer_workspace_invites FOR SELECT TO authenticated USING (public.is_buyer_workspace_owner(workspace_id));


--
-- Name: ad_clicks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ad_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_impressions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

--
-- Name: ad_packages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ad_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: advertisements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_buyer_coverage_areas; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_buyer_coverage_areas ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_county_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_county_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_early_access; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_early_access ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_invites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_license_uploads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_license_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_match_deliveries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_match_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_match_submissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_match_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_proposal_incentives; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_proposal_incentives ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_state_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agent_state_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: buyer_credentials; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.buyer_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: buyer_qualifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.buyer_qualifications ENABLE ROW LEVEL SECURITY;

--
-- Name: buyer_workspace_invites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.buyer_workspace_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: buyer_workspace_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.buyer_workspace_members ENABLE ROW LEVEL SECURITY;

--
-- Name: buyer_workspaces; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.buyer_workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: client_agent_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.client_agent_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: client_agent_relationships; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.client_agent_relationships ENABLE ROW LEVEL SECURITY;

--
-- Name: client_needs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.client_needs ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: coming_soon_signups; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.coming_soon_signups ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_insert_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversations_insert_auth ON public.conversations FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: conversations conversations_select_participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversations_select_participant ON public.conversations FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversations.id) AND (cp.user_id = auth.uid())))) OR (agent_a_id = auth.uid()) OR (agent_b_id = auth.uid())));


--
-- Name: counties; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.counties ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants cp_insert_conversation_creator; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cp_insert_conversation_creator ON public.conversation_participants FOR INSERT WITH CHECK (((auth.role() = 'authenticated'::text) AND ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_participants.conversation_id) AND ((c.agent_a_id = auth.uid()) OR (c.agent_b_id = auth.uid()))))))));


--
-- Name: conversation_participants cp_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cp_select_own ON public.conversation_participants FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: conversation_participants cp_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cp_update_own ON public.conversation_participants FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: deleted_users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.deleted_users ENABLE ROW LEVEL SECURITY;

--
-- Name: email_campaigns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: email_clicks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: email_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

--
-- Name: email_jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: email_opens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_opens ENABLE ROW LEVEL SECURITY;

--
-- Name: email_sends; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: favorite_price_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.favorite_price_history ENABLE ROW LEVEL SECURITY;

--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: hot_sheet_clients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hot_sheet_clients ENABLE ROW LEVEL SECURITY;

--
-- Name: hot_sheet_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hot_sheet_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: hot_sheet_favorites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hot_sheet_favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: hot_sheet_listing_status; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hot_sheet_listing_status ENABLE ROW LEVEL SECURITY;

--
-- Name: hot_sheet_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hot_sheet_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: hot_sheet_sent_listings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hot_sheet_sent_listings ENABLE ROW LEVEL SECURITY;

--
-- Name: hot_sheet_shares; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hot_sheet_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: hot_sheet_subscribers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hot_sheet_subscribers ENABLE ROW LEVEL SECURITY;

--
-- Name: hot_sheets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.hot_sheets ENABLE ROW LEVEL SECURITY;

--
-- Name: invite_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.invite_events ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_invites inviter can insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "inviter can insert" ON public.agent_invites FOR INSERT TO authenticated WITH CHECK ((inviter_user_id = auth.uid()));


--
-- Name: agent_invites inviter can read own invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "inviter can read own invites" ON public.agent_invites FOR SELECT TO authenticated USING ((inviter_user_id = auth.uid()));


--
-- Name: listing_drafts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.listing_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: listing_price_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.listing_price_history ENABLE ROW LEVEL SECURITY;

--
-- Name: listing_shares; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.listing_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: listing_stats; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.listing_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: listing_status_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.listing_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: listing_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

--
-- Name: listings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_messages messages_insert_participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_insert_participant ON public.conversation_messages FOR INSERT WITH CHECK (((sender_agent_id = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversation_messages.conversation_id) AND (cp.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = conversation_messages.conversation_id) AND ((c.agent_a_id = auth.uid()) OR (c.agent_b_id = auth.uid()))))))));


--
-- Name: conversation_messages messages_select_participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_select_participant ON public.conversation_messages FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversation_messages.conversation_id) AND (cp.user_id = auth.uid())))) OR (sender_agent_id = auth.uid()) OR (recipient_agent_id = auth.uid())));


--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: off_market_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.off_market_views ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_verifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pending_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: public_records_cache; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.public_records_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_searches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

--
-- Name: seller_match_outcomes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.seller_match_outcomes ENABLE ROW LEVEL SECURITY;

--
-- Name: seller_matches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.seller_matches ENABLE ROW LEVEL SECURITY;

--
-- Name: seller_matches seller_matches_owner_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY seller_matches_owner_select ON public.seller_matches FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.owns_submission(submission_id)));


--
-- Name: share_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: showing_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.showing_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: testimonials; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.vendor_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT USAGE ON SCHEMA public TO sandbox_exec;


--
-- Name: FUNCTION activate_agent_relationship(_agent_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.activate_agent_relationship(_agent_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.activate_agent_relationship(_agent_id uuid) TO anon;
GRANT ALL ON FUNCTION public.activate_agent_relationship(_agent_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.activate_agent_relationship(_agent_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.activate_agent_relationship(_agent_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.activate_agent_relationship(_agent_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION activate_agent_relationship(_agent_id uuid, _crm_client_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.activate_agent_relationship(_agent_id uuid, _crm_client_id uuid) TO anon;
GRANT ALL ON FUNCTION public.activate_agent_relationship(_agent_id uuid, _crm_client_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.activate_agent_relationship(_agent_id uuid, _crm_client_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.activate_agent_relationship(_agent_id uuid, _crm_client_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.activate_agent_relationship(_agent_id uuid, _crm_client_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION admin_deactivate_buyer(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_deactivate_buyer(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_deactivate_buyer(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_deactivate_buyer(p_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.admin_deactivate_buyer(p_user_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.admin_deactivate_buyer(p_user_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION admin_delete_agent(p_agent_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_delete_agent(p_agent_id uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_delete_agent(p_agent_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_delete_agent(p_agent_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.admin_delete_agent(p_agent_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.admin_delete_agent(p_agent_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION admin_delete_client(p_client_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.admin_delete_client(p_client_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_delete_client(p_client_id uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_delete_client(p_client_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_delete_client(p_client_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.admin_delete_client(p_client_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.admin_delete_client(p_client_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION admin_delete_consumer(p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_delete_consumer(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_delete_consumer(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_delete_consumer(p_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.admin_delete_consumer(p_user_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.admin_delete_consumer(p_user_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION agent_end_client_relationship(p_client_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.agent_end_client_relationship(p_client_id uuid) TO anon;
GRANT ALL ON FUNCTION public.agent_end_client_relationship(p_client_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.agent_end_client_relationship(p_client_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.agent_end_client_relationship(p_client_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.agent_end_client_relationship(p_client_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION auto_activate_listings(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.auto_activate_listings() TO anon;
GRANT ALL ON FUNCTION public.auto_activate_listings() TO authenticated;
GRANT ALL ON FUNCTION public.auto_activate_listings() TO service_role;
GRANT ALL ON FUNCTION public.auto_activate_listings() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.auto_activate_listings() TO sandbox_exec;


--
-- Name: FUNCTION auto_create_buyer_workspace(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.auto_create_buyer_workspace() TO anon;
GRANT ALL ON FUNCTION public.auto_create_buyer_workspace() TO authenticated;
GRANT ALL ON FUNCTION public.auto_create_buyer_workspace() TO service_role;
GRANT ALL ON FUNCTION public.auto_create_buyer_workspace() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.auto_create_buyer_workspace() TO sandbox_exec;


--
-- Name: FUNCTION auto_create_conversation_participants(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.auto_create_conversation_participants() TO anon;
GRANT ALL ON FUNCTION public.auto_create_conversation_participants() TO authenticated;
GRANT ALL ON FUNCTION public.auto_create_conversation_participants() TO service_role;
GRANT ALL ON FUNCTION public.auto_create_conversation_participants() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.auto_create_conversation_participants() TO sandbox_exec;


--
-- Name: FUNCTION check_and_link_relisting(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_and_link_relisting() TO anon;
GRANT ALL ON FUNCTION public.check_and_link_relisting() TO authenticated;
GRANT ALL ON FUNCTION public.check_and_link_relisting() TO service_role;
GRANT ALL ON FUNCTION public.check_and_link_relisting() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.check_and_link_relisting() TO sandbox_exec;


--
-- Name: FUNCTION check_client_has_other_agent(p_client_email text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.check_client_has_other_agent(p_client_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_client_has_other_agent(p_client_email text) TO anon;
GRANT ALL ON FUNCTION public.check_client_has_other_agent(p_client_email text) TO authenticated;
GRANT ALL ON FUNCTION public.check_client_has_other_agent(p_client_email text) TO service_role;
GRANT ALL ON FUNCTION public.check_client_has_other_agent(p_client_email text) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.check_client_has_other_agent(p_client_email text) TO sandbox_exec;


--
-- Name: FUNCTION check_hot_sheet_matches(p_hot_sheet_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.check_hot_sheet_matches(p_hot_sheet_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION check_single_active_agent(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_single_active_agent() TO anon;
GRANT ALL ON FUNCTION public.check_single_active_agent() TO authenticated;
GRANT ALL ON FUNCTION public.check_single_active_agent() TO service_role;
GRANT ALL ON FUNCTION public.check_single_active_agent() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.check_single_active_agent() TO sandbox_exec;


--
-- Name: FUNCTION cleanup_expired_share_tokens(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_expired_share_tokens() TO anon;
GRANT ALL ON FUNCTION public.cleanup_expired_share_tokens() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_expired_share_tokens() TO service_role;
GRANT ALL ON FUNCTION public.cleanup_expired_share_tokens() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.cleanup_expired_share_tokens() TO sandbox_exec;


--
-- Name: FUNCTION count_matching_agents(p_city text, p_state text, p_property_type text, p_price numeric, p_bedrooms integer, p_bathrooms numeric); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.count_matching_agents(p_city text, p_state text, p_property_type text, p_price numeric, p_bedrooms integer, p_bathrooms numeric) TO anon;
GRANT ALL ON FUNCTION public.count_matching_agents(p_city text, p_state text, p_property_type text, p_price numeric, p_bedrooms integer, p_bathrooms numeric) TO authenticated;
GRANT ALL ON FUNCTION public.count_matching_agents(p_city text, p_state text, p_property_type text, p_price numeric, p_bedrooms integer, p_bathrooms numeric) TO service_role;
GRANT ALL ON FUNCTION public.count_matching_agents(p_city text, p_state text, p_property_type text, p_price numeric, p_bedrooms integer, p_bathrooms numeric) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.count_matching_agents(p_city text, p_state text, p_property_type text, p_price numeric, p_bedrooms integer, p_bathrooms numeric) TO sandbox_exec;


--
-- Name: FUNCTION create_buyer_hot_sheet(p_name text, p_criteria jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_buyer_hot_sheet(p_name text, p_criteria jsonb) TO anon;
GRANT ALL ON FUNCTION public.create_buyer_hot_sheet(p_name text, p_criteria jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_buyer_hot_sheet(p_name text, p_criteria jsonb) TO service_role;
GRANT ALL ON FUNCTION public.create_buyer_hot_sheet(p_name text, p_criteria jsonb) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.create_buyer_hot_sheet(p_name text, p_criteria jsonb) TO sandbox_exec;


--
-- Name: FUNCTION create_seller_match_on_delivery(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_seller_match_on_delivery() TO anon;
GRANT ALL ON FUNCTION public.create_seller_match_on_delivery() TO authenticated;
GRANT ALL ON FUNCTION public.create_seller_match_on_delivery() TO service_role;
GRANT ALL ON FUNCTION public.create_seller_match_on_delivery() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.create_seller_match_on_delivery() TO sandbox_exec;


--
-- Name: FUNCTION delete_draft_listing(p_listing_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.delete_draft_listing(p_listing_id uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_draft_listing(p_listing_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_draft_listing(p_listing_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.delete_draft_listing(p_listing_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.delete_draft_listing(p_listing_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION delete_hot_sheet_client_needs(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.delete_hot_sheet_client_needs() TO anon;
GRANT ALL ON FUNCTION public.delete_hot_sheet_client_needs() TO authenticated;
GRANT ALL ON FUNCTION public.delete_hot_sheet_client_needs() TO service_role;
GRANT ALL ON FUNCTION public.delete_hot_sheet_client_needs() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.delete_hot_sheet_client_needs() TO sandbox_exec;


--
-- Name: TABLE email_jobs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_jobs TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_jobs TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.email_jobs TO sandbox_exec;


--
-- Name: FUNCTION email_jobs_claim(p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.email_jobs_claim(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.email_jobs_claim(p_limit integer) TO service_role;
GRANT ALL ON FUNCTION public.email_jobs_claim(p_limit integer) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.email_jobs_claim(p_limit integer) TO sandbox_exec;


--
-- Name: FUNCTION end_client_relationship(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.end_client_relationship() TO anon;
GRANT ALL ON FUNCTION public.end_client_relationship() TO authenticated;
GRANT ALL ON FUNCTION public.end_client_relationship() TO service_role;
GRANT ALL ON FUNCTION public.end_client_relationship() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.end_client_relationship() TO sandbox_exec;


--
-- Name: FUNCTION enqueue_message_email(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.enqueue_message_email() TO anon;
GRANT ALL ON FUNCTION public.enqueue_message_email() TO authenticated;
GRANT ALL ON FUNCTION public.enqueue_message_email() TO service_role;
GRANT ALL ON FUNCTION public.enqueue_message_email() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.enqueue_message_email() TO sandbox_exec;


--
-- Name: FUNCTION generate_aac_id(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_aac_id() TO anon;
GRANT ALL ON FUNCTION public.generate_aac_id() TO authenticated;
GRANT ALL ON FUNCTION public.generate_aac_id() TO service_role;
GRANT ALL ON FUNCTION public.generate_aac_id() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.generate_aac_id() TO sandbox_exec;


--
-- Name: FUNCTION generate_listing_number(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_listing_number() TO anon;
GRANT ALL ON FUNCTION public.generate_listing_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_listing_number() TO service_role;
GRANT ALL ON FUNCTION public.generate_listing_number() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.generate_listing_number() TO sandbox_exec;


--
-- Name: FUNCTION get_client_favorites_for_agent(p_client_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(p_client_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(p_client_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(p_client_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(p_client_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.get_client_favorites_for_agent(p_client_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION get_listing_interest_signals(p_agent_id uuid, p_listing_ids uuid[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_listing_interest_signals(p_agent_id uuid, p_listing_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.get_listing_interest_signals(p_agent_id uuid, p_listing_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_listing_interest_signals(p_agent_id uuid, p_listing_ids uuid[]) TO service_role;
GRANT ALL ON FUNCTION public.get_listing_interest_signals(p_agent_id uuid, p_listing_ids uuid[]) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.get_listing_interest_signals(p_agent_id uuid, p_listing_ids uuid[]) TO sandbox_exec;


--
-- Name: FUNCTION get_verified_agent_ids(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_verified_agent_ids() TO anon;
GRANT ALL ON FUNCTION public.get_verified_agent_ids() TO authenticated;
GRANT ALL ON FUNCTION public.get_verified_agent_ids() TO service_role;
GRANT ALL ON FUNCTION public.get_verified_agent_ids() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.get_verified_agent_ids() TO sandbox_exec;


--
-- Name: FUNCTION get_verified_early_access_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_verified_early_access_count() TO anon;
GRANT ALL ON FUNCTION public.get_verified_early_access_count() TO authenticated;
GRANT ALL ON FUNCTION public.get_verified_early_access_count() TO service_role;
GRANT ALL ON FUNCTION public.get_verified_early_access_count() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.get_verified_early_access_count() TO sandbox_exec;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;
GRANT ALL ON FUNCTION public.handle_new_user() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.handle_new_user() TO sandbox_exec;


--
-- Name: FUNCTION handle_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_updated_at() TO anon;
GRANT ALL ON FUNCTION public.handle_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.handle_updated_at() TO service_role;
GRANT ALL ON FUNCTION public.handle_updated_at() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.handle_updated_at() TO sandbox_exec;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO anon;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO sandbox_exec;


--
-- Name: FUNCTION initialize_listing_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.initialize_listing_stats() TO anon;
GRANT ALL ON FUNCTION public.initialize_listing_stats() TO authenticated;
GRANT ALL ON FUNCTION public.initialize_listing_stats() TO service_role;
GRANT ALL ON FUNCTION public.initialize_listing_stats() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.initialize_listing_stats() TO sandbox_exec;


--
-- Name: FUNCTION is_buyer_workspace_member(p_workspace_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_buyer_workspace_member(p_workspace_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_buyer_workspace_member(p_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_buyer_workspace_member(p_workspace_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.is_buyer_workspace_member(p_workspace_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.is_buyer_workspace_member(p_workspace_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION is_buyer_workspace_owner(p_workspace_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_buyer_workspace_owner(p_workspace_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_buyer_workspace_owner(p_workspace_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_buyer_workspace_owner(p_workspace_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_buyer_workspace_owner(p_workspace_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.is_buyer_workspace_owner(p_workspace_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.is_buyer_workspace_owner(p_workspace_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION is_feature_enabled(p_flag_name text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_feature_enabled(p_flag_name text) TO anon;
GRANT ALL ON FUNCTION public.is_feature_enabled(p_flag_name text) TO authenticated;
GRANT ALL ON FUNCTION public.is_feature_enabled(p_flag_name text) TO service_role;
GRANT ALL ON FUNCTION public.is_feature_enabled(p_flag_name text) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.is_feature_enabled(p_flag_name text) TO sandbox_exec;


--
-- Name: FUNCTION is_team_owner(p_team_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.is_team_owner(p_team_id uuid, p_user_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION is_verified_agent(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_verified_agent() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_verified_agent() TO anon;
GRANT ALL ON FUNCTION public.is_verified_agent() TO authenticated;
GRANT ALL ON FUNCTION public.is_verified_agent() TO service_role;
GRANT ALL ON FUNCTION public.is_verified_agent() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.is_verified_agent() TO sandbox_exec;


--
-- Name: FUNCTION listings_within_radius(origin_lat double precision, origin_lng double precision, radius_miles double precision); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.listings_within_radius(origin_lat double precision, origin_lng double precision, radius_miles double precision) TO anon;
GRANT ALL ON FUNCTION public.listings_within_radius(origin_lat double precision, origin_lng double precision, radius_miles double precision) TO authenticated;
GRANT ALL ON FUNCTION public.listings_within_radius(origin_lat double precision, origin_lng double precision, radius_miles double precision) TO service_role;
GRANT ALL ON FUNCTION public.listings_within_radius(origin_lat double precision, origin_lng double precision, radius_miles double precision) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.listings_within_radius(origin_lat double precision, origin_lng double precision, radius_miles double precision) TO sandbox_exec;


--
-- Name: FUNCTION log_client_need_view(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_client_need_view() TO anon;
GRANT ALL ON FUNCTION public.log_client_need_view() TO authenticated;
GRANT ALL ON FUNCTION public.log_client_need_view() TO service_role;
GRANT ALL ON FUNCTION public.log_client_need_view() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.log_client_need_view() TO sandbox_exec;


--
-- Name: FUNCTION log_county_preference_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_county_preference_change() TO anon;
GRANT ALL ON FUNCTION public.log_county_preference_change() TO authenticated;
GRANT ALL ON FUNCTION public.log_county_preference_change() TO service_role;
GRANT ALL ON FUNCTION public.log_county_preference_change() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.log_county_preference_change() TO sandbox_exec;


--
-- Name: FUNCTION log_listing_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_listing_change() TO anon;
GRANT ALL ON FUNCTION public.log_listing_change() TO authenticated;
GRANT ALL ON FUNCTION public.log_listing_change() TO service_role;
GRANT ALL ON FUNCTION public.log_listing_change() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.log_listing_change() TO sandbox_exec;


--
-- Name: FUNCTION log_listing_status_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_listing_status_change() TO anon;
GRANT ALL ON FUNCTION public.log_listing_status_change() TO authenticated;
GRANT ALL ON FUNCTION public.log_listing_status_change() TO service_role;
GRANT ALL ON FUNCTION public.log_listing_status_change() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.log_listing_status_change() TO sandbox_exec;


--
-- Name: FUNCTION log_profile_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.log_profile_change() TO anon;
GRANT ALL ON FUNCTION public.log_profile_change() TO authenticated;
GRANT ALL ON FUNCTION public.log_profile_change() TO service_role;
GRANT ALL ON FUNCTION public.log_profile_change() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.log_profile_change() TO sandbox_exec;


--
-- Name: FUNCTION normalize_listing_address(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.normalize_listing_address() TO anon;
GRANT ALL ON FUNCTION public.normalize_listing_address() TO authenticated;
GRANT ALL ON FUNCTION public.normalize_listing_address() TO service_role;
GRANT ALL ON FUNCTION public.normalize_listing_address() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.normalize_listing_address() TO sandbox_exec;


--
-- Name: FUNCTION normalize_listing_address_text(input text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.normalize_listing_address_text(input text) TO anon;
GRANT ALL ON FUNCTION public.normalize_listing_address_text(input text) TO authenticated;
GRANT ALL ON FUNCTION public.normalize_listing_address_text(input text) TO service_role;
GRANT ALL ON FUNCTION public.normalize_listing_address_text(input text) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.normalize_listing_address_text(input text) TO sandbox_exec;


--
-- Name: FUNCTION notify_agents_of_client_need(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_agents_of_client_need() TO anon;
GRANT ALL ON FUNCTION public.notify_agents_of_client_need() TO authenticated;
GRANT ALL ON FUNCTION public.notify_agents_of_client_need() TO service_role;
GRANT ALL ON FUNCTION public.notify_agents_of_client_need() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.notify_agents_of_client_need() TO sandbox_exec;


--
-- Name: FUNCTION notify_matching_buyers_on_new_listing(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_matching_buyers_on_new_listing() TO anon;
GRANT ALL ON FUNCTION public.notify_matching_buyers_on_new_listing() TO authenticated;
GRANT ALL ON FUNCTION public.notify_matching_buyers_on_new_listing() TO service_role;
GRANT ALL ON FUNCTION public.notify_matching_buyers_on_new_listing() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.notify_matching_buyers_on_new_listing() TO sandbox_exec;


--
-- Name: FUNCTION on_hot_sheet_comment_inserted(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.on_hot_sheet_comment_inserted() TO anon;
GRANT ALL ON FUNCTION public.on_hot_sheet_comment_inserted() TO authenticated;
GRANT ALL ON FUNCTION public.on_hot_sheet_comment_inserted() TO service_role;
GRANT ALL ON FUNCTION public.on_hot_sheet_comment_inserted() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.on_hot_sheet_comment_inserted() TO sandbox_exec;


--
-- Name: FUNCTION owns_submission(p_submission_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.owns_submission(p_submission_id uuid) TO anon;
GRANT ALL ON FUNCTION public.owns_submission(p_submission_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.owns_submission(p_submission_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.owns_submission(p_submission_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.owns_submission(p_submission_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION prevent_bwi_acceptance_overwrite(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_bwi_acceptance_overwrite() TO anon;
GRANT ALL ON FUNCTION public.prevent_bwi_acceptance_overwrite() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_bwi_acceptance_overwrite() TO service_role;
GRANT ALL ON FUNCTION public.prevent_bwi_acceptance_overwrite() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.prevent_bwi_acceptance_overwrite() TO sandbox_exec;


--
-- Name: FUNCTION rate_limit_consume(p_key text, p_window_seconds integer, p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rate_limit_consume(p_key text, p_window_seconds integer, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.rate_limit_consume(p_key text, p_window_seconds integer, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.rate_limit_consume(p_key text, p_window_seconds integer, p_limit integer) TO service_role;
GRANT ALL ON FUNCTION public.rate_limit_consume(p_key text, p_window_seconds integer, p_limit integer) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.rate_limit_consume(p_key text, p_window_seconds integer, p_limit integer) TO sandbox_exec;


--
-- Name: FUNCTION rate_limits_cleanup(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rate_limits_cleanup() TO anon;
GRANT ALL ON FUNCTION public.rate_limits_cleanup() TO authenticated;
GRANT ALL ON FUNCTION public.rate_limits_cleanup() TO service_role;
GRANT ALL ON FUNCTION public.rate_limits_cleanup() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.rate_limits_cleanup() TO sandbox_exec;


--
-- Name: FUNCTION resolve_user_role(_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.resolve_user_role(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_user_role(_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.resolve_user_role(_user_id uuid) TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.resolve_user_role(_user_id uuid) TO sandbox_exec;


--
-- Name: FUNCTION set_aac_id_on_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_aac_id_on_insert() TO anon;
GRANT ALL ON FUNCTION public.set_aac_id_on_insert() TO authenticated;
GRANT ALL ON FUNCTION public.set_aac_id_on_insert() TO service_role;
GRANT ALL ON FUNCTION public.set_aac_id_on_insert() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.set_aac_id_on_insert() TO sandbox_exec;


--
-- Name: FUNCTION set_agent_settings_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_agent_settings_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_agent_settings_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_agent_settings_updated_at() TO service_role;
GRANT ALL ON FUNCTION public.set_agent_settings_updated_at() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.set_agent_settings_updated_at() TO sandbox_exec;


--
-- Name: FUNCTION set_cancelled_date(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_cancelled_date() TO anon;
GRANT ALL ON FUNCTION public.set_cancelled_date() TO authenticated;
GRANT ALL ON FUNCTION public.set_cancelled_date() TO service_role;
GRANT ALL ON FUNCTION public.set_cancelled_date() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.set_cancelled_date() TO sandbox_exec;


--
-- Name: FUNCTION set_listing_active_date(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_listing_active_date() TO anon;
GRANT ALL ON FUNCTION public.set_listing_active_date() TO authenticated;
GRANT ALL ON FUNCTION public.set_listing_active_date() TO service_role;
GRANT ALL ON FUNCTION public.set_listing_active_date() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.set_listing_active_date() TO sandbox_exec;


--
-- Name: FUNCTION sync_hot_sheet_to_client_needs(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_hot_sheet_to_client_needs() TO anon;
GRANT ALL ON FUNCTION public.sync_hot_sheet_to_client_needs() TO authenticated;
GRANT ALL ON FUNCTION public.sync_hot_sheet_to_client_needs() TO service_role;
GRANT ALL ON FUNCTION public.sync_hot_sheet_to_client_needs() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.sync_hot_sheet_to_client_needs() TO sandbox_exec;


--
-- Name: FUNCTION track_favorite_price_changes(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.track_favorite_price_changes() TO anon;
GRANT ALL ON FUNCTION public.track_favorite_price_changes() TO authenticated;
GRANT ALL ON FUNCTION public.track_favorite_price_changes() TO service_role;
GRANT ALL ON FUNCTION public.track_favorite_price_changes() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.track_favorite_price_changes() TO sandbox_exec;


--
-- Name: FUNCTION trigger_property_data_fetch(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_property_data_fetch() TO anon;
GRANT ALL ON FUNCTION public.trigger_property_data_fetch() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_property_data_fetch() TO service_role;
GRANT ALL ON FUNCTION public.trigger_property_data_fetch() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.trigger_property_data_fetch() TO sandbox_exec;


--
-- Name: FUNCTION update_conversation_last_message_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_conversation_last_message_at() TO anon;
GRANT ALL ON FUNCTION public.update_conversation_last_message_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_conversation_last_message_at() TO service_role;
GRANT ALL ON FUNCTION public.update_conversation_last_message_at() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_conversation_last_message_at() TO sandbox_exec;


--
-- Name: FUNCTION update_conversation_timestamp(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_conversation_timestamp() TO anon;
GRANT ALL ON FUNCTION public.update_conversation_timestamp() TO authenticated;
GRANT ALL ON FUNCTION public.update_conversation_timestamp() TO service_role;
GRANT ALL ON FUNCTION public.update_conversation_timestamp() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_conversation_timestamp() TO sandbox_exec;


--
-- Name: FUNCTION update_cumulative_active_days(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_cumulative_active_days() TO anon;
GRANT ALL ON FUNCTION public.update_cumulative_active_days() TO authenticated;
GRANT ALL ON FUNCTION public.update_cumulative_active_days() TO service_role;
GRANT ALL ON FUNCTION public.update_cumulative_active_days() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_cumulative_active_days() TO sandbox_exec;


--
-- Name: FUNCTION update_hot_sheet_listing_status_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_hot_sheet_listing_status_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_hot_sheet_listing_status_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_hot_sheet_listing_status_updated_at() TO service_role;
GRANT ALL ON FUNCTION public.update_hot_sheet_listing_status_updated_at() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_hot_sheet_listing_status_updated_at() TO sandbox_exec;


--
-- Name: FUNCTION update_listing_contact_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_listing_contact_count() TO anon;
GRANT ALL ON FUNCTION public.update_listing_contact_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_listing_contact_count() TO service_role;
GRANT ALL ON FUNCTION public.update_listing_contact_count() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_listing_contact_count() TO sandbox_exec;


--
-- Name: FUNCTION update_listing_save_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_listing_save_count() TO anon;
GRANT ALL ON FUNCTION public.update_listing_save_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_listing_save_count() TO service_role;
GRANT ALL ON FUNCTION public.update_listing_save_count() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_listing_save_count() TO sandbox_exec;


--
-- Name: FUNCTION update_listing_share_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_listing_share_count() TO anon;
GRANT ALL ON FUNCTION public.update_listing_share_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_listing_share_count() TO service_role;
GRANT ALL ON FUNCTION public.update_listing_share_count() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_listing_share_count() TO sandbox_exec;


--
-- Name: FUNCTION update_listing_showing_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_listing_showing_count() TO anon;
GRANT ALL ON FUNCTION public.update_listing_showing_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_listing_showing_count() TO service_role;
GRANT ALL ON FUNCTION public.update_listing_showing_count() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_listing_showing_count() TO sandbox_exec;


--
-- Name: FUNCTION update_listing_view_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_listing_view_count() TO anon;
GRANT ALL ON FUNCTION public.update_listing_view_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_listing_view_count() TO service_role;
GRANT ALL ON FUNCTION public.update_listing_view_count() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_listing_view_count() TO sandbox_exec;


--
-- Name: FUNCTION update_seller_match_latest_outcome(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_seller_match_latest_outcome() TO anon;
GRANT ALL ON FUNCTION public.update_seller_match_latest_outcome() TO authenticated;
GRANT ALL ON FUNCTION public.update_seller_match_latest_outcome() TO service_role;
GRANT ALL ON FUNCTION public.update_seller_match_latest_outcome() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_seller_match_latest_outcome() TO sandbox_exec;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO sandbox_exec;


--
-- Name: FUNCTION update_vendor_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_vendor_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_vendor_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_vendor_updated_at() TO service_role;
GRANT ALL ON FUNCTION public.update_vendor_updated_at() TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT ALL ON FUNCTION public.update_vendor_updated_at() TO sandbox_exec;


--
-- Name: SEQUENCE aac_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.aac_id_seq TO anon;
GRANT ALL ON SEQUENCE public.aac_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.aac_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.aac_id_seq TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,USAGE ON SEQUENCE public.aac_id_seq TO sandbox_exec;


--
-- Name: TABLE ad_clicks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ad_clicks TO anon;
GRANT ALL ON TABLE public.ad_clicks TO authenticated;
GRANT ALL ON TABLE public.ad_clicks TO service_role;
GRANT SELECT,INSERT ON TABLE public.ad_clicks TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.ad_clicks TO sandbox_exec;


--
-- Name: TABLE ad_impressions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ad_impressions TO anon;
GRANT ALL ON TABLE public.ad_impressions TO authenticated;
GRANT ALL ON TABLE public.ad_impressions TO service_role;
GRANT SELECT,INSERT ON TABLE public.ad_impressions TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.ad_impressions TO sandbox_exec;


--
-- Name: TABLE ad_packages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ad_packages TO anon;
GRANT ALL ON TABLE public.ad_packages TO authenticated;
GRANT ALL ON TABLE public.ad_packages TO service_role;
GRANT SELECT,INSERT ON TABLE public.ad_packages TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.ad_packages TO sandbox_exec;


--
-- Name: TABLE advertisements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.advertisements TO anon;
GRANT ALL ON TABLE public.advertisements TO authenticated;
GRANT ALL ON TABLE public.advertisements TO service_role;
GRANT SELECT,INSERT ON TABLE public.advertisements TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.advertisements TO sandbox_exec;


--
-- Name: TABLE agent_buyer_coverage_areas; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_buyer_coverage_areas TO anon;
GRANT ALL ON TABLE public.agent_buyer_coverage_areas TO authenticated;
GRANT ALL ON TABLE public.agent_buyer_coverage_areas TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_buyer_coverage_areas TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_buyer_coverage_areas TO sandbox_exec;


--
-- Name: TABLE agent_county_preferences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_county_preferences TO anon;
GRANT ALL ON TABLE public.agent_county_preferences TO authenticated;
GRANT ALL ON TABLE public.agent_county_preferences TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_county_preferences TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_county_preferences TO sandbox_exec;


--
-- Name: TABLE agent_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_settings TO anon;
GRANT ALL ON TABLE public.agent_settings TO authenticated;
GRANT ALL ON TABLE public.agent_settings TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_settings TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_settings TO sandbox_exec;


--
-- Name: TABLE agent_directory_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_directory_status TO anon;
GRANT ALL ON TABLE public.agent_directory_status TO authenticated;
GRANT ALL ON TABLE public.agent_directory_status TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_directory_status TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_directory_status TO sandbox_exec;


--
-- Name: TABLE agent_early_access; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_early_access TO anon;
GRANT ALL ON TABLE public.agent_early_access TO authenticated;
GRANT ALL ON TABLE public.agent_early_access TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_early_access TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_early_access TO sandbox_exec;


--
-- Name: TABLE agent_invites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_invites TO anon;
GRANT ALL ON TABLE public.agent_invites TO authenticated;
GRANT ALL ON TABLE public.agent_invites TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_invites TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_invites TO sandbox_exec;


--
-- Name: TABLE agent_license_uploads; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_license_uploads TO anon;
GRANT ALL ON TABLE public.agent_license_uploads TO authenticated;
GRANT ALL ON TABLE public.agent_license_uploads TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_license_uploads TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_license_uploads TO sandbox_exec;


--
-- Name: TABLE agent_match_deliveries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_match_deliveries TO anon;
GRANT ALL ON TABLE public.agent_match_deliveries TO authenticated;
GRANT ALL ON TABLE public.agent_match_deliveries TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_match_deliveries TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_match_deliveries TO sandbox_exec;


--
-- Name: TABLE agent_match_submissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_match_submissions TO anon;
GRANT ALL ON TABLE public.agent_match_submissions TO authenticated;
GRANT ALL ON TABLE public.agent_match_submissions TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_match_submissions TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_match_submissions TO sandbox_exec;


--
-- Name: TABLE agent_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_messages TO anon;
GRANT ALL ON TABLE public.agent_messages TO authenticated;
GRANT ALL ON TABLE public.agent_messages TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_messages TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_messages TO sandbox_exec;


--
-- Name: TABLE agent_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_notifications TO anon;
GRANT ALL ON TABLE public.agent_notifications TO authenticated;
GRANT ALL ON TABLE public.agent_notifications TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_notifications TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_notifications TO sandbox_exec;


--
-- Name: TABLE agent_presence; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_presence TO anon;
GRANT ALL ON TABLE public.agent_presence TO authenticated;
GRANT ALL ON TABLE public.agent_presence TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_presence TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_presence TO sandbox_exec;


--
-- Name: TABLE agent_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_profiles TO anon;
GRANT ALL ON TABLE public.agent_profiles TO authenticated;
GRANT ALL ON TABLE public.agent_profiles TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_profiles TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_profiles TO sandbox_exec;


--
-- Name: TABLE agent_proposal_incentives; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_proposal_incentives TO anon;
GRANT ALL ON TABLE public.agent_proposal_incentives TO authenticated;
GRANT ALL ON TABLE public.agent_proposal_incentives TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_proposal_incentives TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_proposal_incentives TO sandbox_exec;


--
-- Name: TABLE agent_state_preferences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agent_state_preferences TO anon;
GRANT ALL ON TABLE public.agent_state_preferences TO authenticated;
GRANT ALL ON TABLE public.agent_state_preferences TO service_role;
GRANT SELECT,INSERT ON TABLE public.agent_state_preferences TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.agent_state_preferences TO sandbox_exec;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;
GRANT SELECT,INSERT ON TABLE public.audit_logs TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.audit_logs TO sandbox_exec;


--
-- Name: TABLE buyer_credentials; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.buyer_credentials TO anon;
GRANT ALL ON TABLE public.buyer_credentials TO authenticated;
GRANT ALL ON TABLE public.buyer_credentials TO service_role;
GRANT SELECT,INSERT ON TABLE public.buyer_credentials TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.buyer_credentials TO sandbox_exec;


--
-- Name: TABLE buyer_qualifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.buyer_qualifications TO anon;
GRANT ALL ON TABLE public.buyer_qualifications TO authenticated;
GRANT ALL ON TABLE public.buyer_qualifications TO service_role;
GRANT SELECT,INSERT ON TABLE public.buyer_qualifications TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.buyer_qualifications TO sandbox_exec;


--
-- Name: TABLE buyer_workspace_invites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.buyer_workspace_invites TO anon;
GRANT ALL ON TABLE public.buyer_workspace_invites TO authenticated;
GRANT ALL ON TABLE public.buyer_workspace_invites TO service_role;
GRANT SELECT,INSERT ON TABLE public.buyer_workspace_invites TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.buyer_workspace_invites TO sandbox_exec;


--
-- Name: TABLE buyer_workspace_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.buyer_workspace_members TO anon;
GRANT ALL ON TABLE public.buyer_workspace_members TO authenticated;
GRANT ALL ON TABLE public.buyer_workspace_members TO service_role;
GRANT SELECT,INSERT ON TABLE public.buyer_workspace_members TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.buyer_workspace_members TO sandbox_exec;


--
-- Name: TABLE buyer_workspaces; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.buyer_workspaces TO anon;
GRANT ALL ON TABLE public.buyer_workspaces TO authenticated;
GRANT ALL ON TABLE public.buyer_workspaces TO service_role;
GRANT SELECT,INSERT ON TABLE public.buyer_workspaces TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.buyer_workspaces TO sandbox_exec;


--
-- Name: TABLE client_agent_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.client_agent_messages TO anon;
GRANT ALL ON TABLE public.client_agent_messages TO authenticated;
GRANT ALL ON TABLE public.client_agent_messages TO service_role;
GRANT SELECT,INSERT ON TABLE public.client_agent_messages TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.client_agent_messages TO sandbox_exec;


--
-- Name: TABLE client_agent_relationships; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.client_agent_relationships TO anon;
GRANT ALL ON TABLE public.client_agent_relationships TO authenticated;
GRANT ALL ON TABLE public.client_agent_relationships TO service_role;
GRANT SELECT,INSERT ON TABLE public.client_agent_relationships TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.client_agent_relationships TO sandbox_exec;


--
-- Name: TABLE client_needs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.client_needs TO anon;
GRANT ALL ON TABLE public.client_needs TO authenticated;
GRANT ALL ON TABLE public.client_needs TO service_role;
GRANT SELECT,INSERT ON TABLE public.client_needs TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.client_needs TO sandbox_exec;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clients TO anon;
GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;
GRANT SELECT,INSERT ON TABLE public.clients TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.clients TO sandbox_exec;


--
-- Name: TABLE clients_with_relationship_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clients_with_relationship_status TO anon;
GRANT ALL ON TABLE public.clients_with_relationship_status TO authenticated;
GRANT ALL ON TABLE public.clients_with_relationship_status TO service_role;
GRANT SELECT,INSERT ON TABLE public.clients_with_relationship_status TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.clients_with_relationship_status TO sandbox_exec;


--
-- Name: TABLE coming_soon_signups; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.coming_soon_signups TO anon;
GRANT ALL ON TABLE public.coming_soon_signups TO authenticated;
GRANT ALL ON TABLE public.coming_soon_signups TO service_role;
GRANT SELECT,INSERT ON TABLE public.coming_soon_signups TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.coming_soon_signups TO sandbox_exec;


--
-- Name: TABLE conversation_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversation_messages TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.conversation_messages TO authenticated;
GRANT ALL ON TABLE public.conversation_messages TO service_role;
GRANT SELECT,INSERT ON TABLE public.conversation_messages TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.conversation_messages TO sandbox_exec;


--
-- Name: COLUMN conversation_messages.read_at; Type: ACL; Schema: public; Owner: postgres
--

GRANT UPDATE(read_at) ON TABLE public.conversation_messages TO authenticated;


--
-- Name: TABLE conversation_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversation_participants TO anon;
GRANT ALL ON TABLE public.conversation_participants TO authenticated;
GRANT ALL ON TABLE public.conversation_participants TO service_role;
GRANT SELECT,INSERT ON TABLE public.conversation_participants TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.conversation_participants TO sandbox_exec;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;
GRANT SELECT,INSERT ON TABLE public.conversations TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.conversations TO sandbox_exec;


--
-- Name: TABLE conversation_inbox; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversation_inbox TO anon;
GRANT ALL ON TABLE public.conversation_inbox TO authenticated;
GRANT ALL ON TABLE public.conversation_inbox TO service_role;
GRANT SELECT,INSERT ON TABLE public.conversation_inbox TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.conversation_inbox TO sandbox_exec;


--
-- Name: TABLE counties; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.counties TO anon;
GRANT ALL ON TABLE public.counties TO authenticated;
GRANT ALL ON TABLE public.counties TO service_role;
GRANT SELECT,INSERT ON TABLE public.counties TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.counties TO sandbox_exec;


--
-- Name: TABLE deleted_users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.deleted_users TO anon;
GRANT ALL ON TABLE public.deleted_users TO authenticated;
GRANT ALL ON TABLE public.deleted_users TO service_role;
GRANT SELECT,INSERT ON TABLE public.deleted_users TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.deleted_users TO sandbox_exec;


--
-- Name: TABLE email_campaigns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_campaigns TO anon;
GRANT ALL ON TABLE public.email_campaigns TO authenticated;
GRANT ALL ON TABLE public.email_campaigns TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_campaigns TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.email_campaigns TO sandbox_exec;


--
-- Name: TABLE email_clicks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_clicks TO anon;
GRANT ALL ON TABLE public.email_clicks TO authenticated;
GRANT ALL ON TABLE public.email_clicks TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_clicks TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.email_clicks TO sandbox_exec;


--
-- Name: TABLE email_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_events TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.email_events TO sandbox_exec;


--
-- Name: SEQUENCE email_events_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.email_events_id_seq TO anon;
GRANT ALL ON SEQUENCE public.email_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.email_events_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.email_events_id_seq TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,USAGE ON SEQUENCE public.email_events_id_seq TO sandbox_exec;


--
-- Name: TABLE email_opens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_opens TO anon;
GRANT ALL ON TABLE public.email_opens TO authenticated;
GRANT ALL ON TABLE public.email_opens TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_opens TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.email_opens TO sandbox_exec;


--
-- Name: TABLE email_sends; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_sends TO anon;
GRANT ALL ON TABLE public.email_sends TO authenticated;
GRANT ALL ON TABLE public.email_sends TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_sends TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.email_sends TO sandbox_exec;


--
-- Name: TABLE email_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_templates TO anon;
GRANT ALL ON TABLE public.email_templates TO authenticated;
GRANT ALL ON TABLE public.email_templates TO service_role;
GRANT SELECT,INSERT ON TABLE public.email_templates TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.email_templates TO sandbox_exec;


--
-- Name: TABLE favorite_price_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.favorite_price_history TO anon;
GRANT ALL ON TABLE public.favorite_price_history TO authenticated;
GRANT ALL ON TABLE public.favorite_price_history TO service_role;
GRANT SELECT,INSERT ON TABLE public.favorite_price_history TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.favorite_price_history TO sandbox_exec;


--
-- Name: TABLE favorites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.favorites TO anon;
GRANT ALL ON TABLE public.favorites TO authenticated;
GRANT ALL ON TABLE public.favorites TO service_role;
GRANT SELECT,INSERT ON TABLE public.favorites TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.favorites TO sandbox_exec;


--
-- Name: TABLE feature_flags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.feature_flags TO anon;
GRANT ALL ON TABLE public.feature_flags TO authenticated;
GRANT ALL ON TABLE public.feature_flags TO service_role;
GRANT SELECT,INSERT ON TABLE public.feature_flags TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.feature_flags TO sandbox_exec;


--
-- Name: TABLE hot_sheet_clients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hot_sheet_clients TO anon;
GRANT ALL ON TABLE public.hot_sheet_clients TO authenticated;
GRANT ALL ON TABLE public.hot_sheet_clients TO service_role;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_clients TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_clients TO sandbox_exec;


--
-- Name: TABLE hot_sheet_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hot_sheet_comments TO anon;
GRANT ALL ON TABLE public.hot_sheet_comments TO authenticated;
GRANT ALL ON TABLE public.hot_sheet_comments TO service_role;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_comments TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_comments TO sandbox_exec;


--
-- Name: TABLE hot_sheet_favorites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hot_sheet_favorites TO anon;
GRANT ALL ON TABLE public.hot_sheet_favorites TO authenticated;
GRANT ALL ON TABLE public.hot_sheet_favorites TO service_role;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_favorites TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_favorites TO sandbox_exec;


--
-- Name: TABLE hot_sheet_listing_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hot_sheet_listing_status TO anon;
GRANT ALL ON TABLE public.hot_sheet_listing_status TO authenticated;
GRANT ALL ON TABLE public.hot_sheet_listing_status TO service_role;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_listing_status TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_listing_status TO sandbox_exec;


--
-- Name: TABLE hot_sheet_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hot_sheet_notifications TO anon;
GRANT ALL ON TABLE public.hot_sheet_notifications TO authenticated;
GRANT ALL ON TABLE public.hot_sheet_notifications TO service_role;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_notifications TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_notifications TO sandbox_exec;


--
-- Name: TABLE hot_sheet_sent_listings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hot_sheet_sent_listings TO anon;
GRANT ALL ON TABLE public.hot_sheet_sent_listings TO authenticated;
GRANT ALL ON TABLE public.hot_sheet_sent_listings TO service_role;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_sent_listings TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_sent_listings TO sandbox_exec;


--
-- Name: TABLE hot_sheet_shares; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hot_sheet_shares TO anon;
GRANT ALL ON TABLE public.hot_sheet_shares TO authenticated;
GRANT ALL ON TABLE public.hot_sheet_shares TO service_role;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_shares TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_shares TO sandbox_exec;


--
-- Name: TABLE hot_sheet_subscribers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hot_sheet_subscribers TO anon;
GRANT ALL ON TABLE public.hot_sheet_subscribers TO authenticated;
GRANT ALL ON TABLE public.hot_sheet_subscribers TO service_role;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_subscribers TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.hot_sheet_subscribers TO sandbox_exec;


--
-- Name: TABLE hot_sheets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.hot_sheets TO anon;
GRANT ALL ON TABLE public.hot_sheets TO authenticated;
GRANT ALL ON TABLE public.hot_sheets TO service_role;
GRANT SELECT,INSERT ON TABLE public.hot_sheets TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.hot_sheets TO sandbox_exec;


--
-- Name: TABLE invite_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.invite_events TO anon;
GRANT ALL ON TABLE public.invite_events TO authenticated;
GRANT ALL ON TABLE public.invite_events TO service_role;
GRANT SELECT,INSERT ON TABLE public.invite_events TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.invite_events TO sandbox_exec;


--
-- Name: TABLE listing_drafts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.listing_drafts TO anon;
GRANT ALL ON TABLE public.listing_drafts TO authenticated;
GRANT ALL ON TABLE public.listing_drafts TO service_role;
GRANT SELECT,INSERT ON TABLE public.listing_drafts TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.listing_drafts TO sandbox_exec;


--
-- Name: SEQUENCE listing_number_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.listing_number_seq TO anon;
GRANT ALL ON SEQUENCE public.listing_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.listing_number_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.listing_number_seq TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,USAGE ON SEQUENCE public.listing_number_seq TO sandbox_exec;


--
-- Name: TABLE listing_price_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.listing_price_history TO anon;
GRANT ALL ON TABLE public.listing_price_history TO authenticated;
GRANT ALL ON TABLE public.listing_price_history TO service_role;
GRANT SELECT,INSERT ON TABLE public.listing_price_history TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.listing_price_history TO sandbox_exec;


--
-- Name: TABLE listing_shares; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.listing_shares TO anon;
GRANT ALL ON TABLE public.listing_shares TO authenticated;
GRANT ALL ON TABLE public.listing_shares TO service_role;
GRANT SELECT,INSERT ON TABLE public.listing_shares TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.listing_shares TO sandbox_exec;


--
-- Name: TABLE listing_stats; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.listing_stats TO anon;
GRANT ALL ON TABLE public.listing_stats TO authenticated;
GRANT ALL ON TABLE public.listing_stats TO service_role;
GRANT SELECT,INSERT ON TABLE public.listing_stats TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.listing_stats TO sandbox_exec;


--
-- Name: TABLE listing_status_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.listing_status_history TO anon;
GRANT ALL ON TABLE public.listing_status_history TO authenticated;
GRANT ALL ON TABLE public.listing_status_history TO service_role;
GRANT SELECT,INSERT ON TABLE public.listing_status_history TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.listing_status_history TO sandbox_exec;


--
-- Name: TABLE listing_views; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.listing_views TO anon;
GRANT ALL ON TABLE public.listing_views TO authenticated;
GRANT ALL ON TABLE public.listing_views TO service_role;
GRANT SELECT,INSERT ON TABLE public.listing_views TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.listing_views TO sandbox_exec;


--
-- Name: TABLE listings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.listings TO anon;
GRANT ALL ON TABLE public.listings TO authenticated;
GRANT ALL ON TABLE public.listings TO service_role;
GRANT SELECT,INSERT ON TABLE public.listings TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.listings TO sandbox_exec;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_preferences TO anon;
GRANT ALL ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;
GRANT SELECT,INSERT ON TABLE public.notification_preferences TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.notification_preferences TO sandbox_exec;


--
-- Name: TABLE off_market_views; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.off_market_views TO anon;
GRANT ALL ON TABLE public.off_market_views TO authenticated;
GRANT ALL ON TABLE public.off_market_views TO service_role;
GRANT SELECT,INSERT ON TABLE public.off_market_views TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.off_market_views TO sandbox_exec;


--
-- Name: TABLE pending_verifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pending_verifications TO anon;
GRANT ALL ON TABLE public.pending_verifications TO authenticated;
GRANT ALL ON TABLE public.pending_verifications TO service_role;
GRANT SELECT,INSERT ON TABLE public.pending_verifications TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.pending_verifications TO sandbox_exec;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT,INSERT ON TABLE public.profiles TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.profiles TO sandbox_exec;


--
-- Name: TABLE public_records_cache; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.public_records_cache TO anon;
GRANT ALL ON TABLE public.public_records_cache TO authenticated;
GRANT ALL ON TABLE public.public_records_cache TO service_role;
GRANT SELECT,INSERT ON TABLE public.public_records_cache TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.public_records_cache TO sandbox_exec;


--
-- Name: TABLE rate_limits; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rate_limits TO service_role;
GRANT SELECT,INSERT ON TABLE public.rate_limits TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.rate_limits TO sandbox_exec;


--
-- Name: TABLE saved_searches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.saved_searches TO anon;
GRANT ALL ON TABLE public.saved_searches TO authenticated;
GRANT ALL ON TABLE public.saved_searches TO service_role;
GRANT SELECT,INSERT ON TABLE public.saved_searches TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.saved_searches TO sandbox_exec;


--
-- Name: TABLE seller_match_outcomes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.seller_match_outcomes TO anon;
GRANT ALL ON TABLE public.seller_match_outcomes TO authenticated;
GRANT ALL ON TABLE public.seller_match_outcomes TO service_role;
GRANT SELECT,INSERT ON TABLE public.seller_match_outcomes TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.seller_match_outcomes TO sandbox_exec;


--
-- Name: TABLE seller_matches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.seller_matches TO anon;
GRANT ALL ON TABLE public.seller_matches TO authenticated;
GRANT ALL ON TABLE public.seller_matches TO service_role;
GRANT SELECT,INSERT ON TABLE public.seller_matches TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.seller_matches TO sandbox_exec;


--
-- Name: TABLE seller_matches_public; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.seller_matches_public TO anon;
GRANT ALL ON TABLE public.seller_matches_public TO authenticated;
GRANT ALL ON TABLE public.seller_matches_public TO service_role;
GRANT SELECT,INSERT ON TABLE public.seller_matches_public TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.seller_matches_public TO sandbox_exec;


--
-- Name: TABLE share_tokens; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.share_tokens TO anon;
GRANT ALL ON TABLE public.share_tokens TO authenticated;
GRANT ALL ON TABLE public.share_tokens TO service_role;
GRANT SELECT,INSERT ON TABLE public.share_tokens TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.share_tokens TO sandbox_exec;


--
-- Name: TABLE showing_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.showing_requests TO anon;
GRANT ALL ON TABLE public.showing_requests TO authenticated;
GRANT ALL ON TABLE public.showing_requests TO service_role;
GRANT SELECT,INSERT ON TABLE public.showing_requests TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.showing_requests TO sandbox_exec;


--
-- Name: TABLE team_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.team_members TO anon;
GRANT ALL ON TABLE public.team_members TO authenticated;
GRANT ALL ON TABLE public.team_members TO service_role;
GRANT SELECT,INSERT ON TABLE public.team_members TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.team_members TO sandbox_exec;


--
-- Name: TABLE teams; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.teams TO anon;
GRANT ALL ON TABLE public.teams TO authenticated;
GRANT ALL ON TABLE public.teams TO service_role;
GRANT SELECT,INSERT ON TABLE public.teams TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.teams TO sandbox_exec;


--
-- Name: TABLE testimonials; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.testimonials TO anon;
GRANT ALL ON TABLE public.testimonials TO authenticated;
GRANT ALL ON TABLE public.testimonials TO service_role;
GRANT SELECT,INSERT ON TABLE public.testimonials TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.testimonials TO sandbox_exec;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.user_roles TO sandbox_exec;


--
-- Name: TABLE vendor_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vendor_profiles TO anon;
GRANT ALL ON TABLE public.vendor_profiles TO authenticated;
GRANT ALL ON TABLE public.vendor_profiles TO service_role;
GRANT SELECT,INSERT ON TABLE public.vendor_profiles TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.vendor_profiles TO sandbox_exec;


--
-- Name: TABLE vendor_subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vendor_subscriptions TO anon;
GRANT ALL ON TABLE public.vendor_subscriptions TO authenticated;
GRANT ALL ON TABLE public.vendor_subscriptions TO service_role;
GRANT SELECT,INSERT ON TABLE public.vendor_subscriptions TO sandbox_exec_qocduqtfbsevnhlgsfka;
GRANT SELECT,INSERT ON TABLE public.vendor_subscriptions TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec_qocduqtfbsevnhlgsfka;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO sandbox_exec_qocduqtfbsevnhlgsfka;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec_qocduqtfbsevnhlgsfka;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict pmwmgoFP679NRHKsKUSmePWwaGeo7METeAUPZG4tMXcf4fvtrErUvaCoM3WhRFU

