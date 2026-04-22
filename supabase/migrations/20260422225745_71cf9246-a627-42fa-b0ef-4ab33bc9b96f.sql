DO $$
DECLARE
  v_target_email text := 'chris.tuite@compass.com';
  v_client_ids uuid[];
  v_hot_sheet_ids uuid[];
  v_auth_user_ids uuid[];
BEGIN
  -- Gather CRM client rows for this email (across all agents)
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_client_ids
  FROM public.clients
  WHERE lower(email) = v_target_email;

  -- Gather auth user ids for this email (via profiles)
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_auth_user_ids
  FROM public.profiles
  WHERE lower(email) = v_target_email;

  -- Gather hot sheets where this person is the buyer
  -- (client_id on hot_sheets references CRM clients in this codebase)
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_hot_sheet_ids
  FROM public.hot_sheets
  WHERE client_id = ANY(v_client_ids);

  -- 1) Cascade-clean dependents on those hot sheets
  IF array_length(v_hot_sheet_ids, 1) IS NOT NULL THEN
    DELETE FROM public.hot_sheet_sent_listings  WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_comments       WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_listing_status WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_notifications  WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
    DELETE FROM public.hot_sheet_favorites      WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
  END IF;

  -- 2) Remove this buyer from any hot_sheet_clients membership (any agent's hot sheet)
  IF array_length(v_client_ids, 1) IS NOT NULL THEN
    DELETE FROM public.hot_sheet_clients WHERE client_id = ANY(v_client_ids);
  END IF;
  IF array_length(v_hot_sheet_ids, 1) IS NOT NULL THEN
    DELETE FROM public.hot_sheet_clients WHERE hot_sheet_id = ANY(v_hot_sheet_ids);
  END IF;

  -- 3) Delete the hot sheets owned for this buyer
  IF array_length(v_hot_sheet_ids, 1) IS NOT NULL THEN
    DELETE FROM public.hot_sheets WHERE id = ANY(v_hot_sheet_ids);
  END IF;

  -- 4) End and remove relationships referencing this buyer (CRM or auth)
  IF array_length(v_client_ids, 1) IS NOT NULL THEN
    DELETE FROM public.client_agent_relationships WHERE crm_client_id = ANY(v_client_ids);
  END IF;
  IF array_length(v_auth_user_ids, 1) IS NOT NULL THEN
    DELETE FROM public.client_agent_relationships WHERE client_id = ANY(v_auth_user_ids);
  END IF;

  -- 5) Email plumbing cleanup (best-effort; ignore missing tables)
  BEGIN
    EXECUTE format('DELETE FROM public.suppressed_emails WHERE lower(email) = %L', v_target_email);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  BEGIN
    EXECUTE format('DELETE FROM public.email_unsubscribe_tokens WHERE lower(email) = %L', v_target_email);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  -- 6) Finally delete the CRM rows themselves (every agent's copy)
  IF array_length(v_client_ids, 1) IS NOT NULL THEN
    DELETE FROM public.clients WHERE id = ANY(v_client_ids);
  END IF;

  RAISE NOTICE 'Wiped CRM data for %: % client rows, % hot sheets, % auth users (auth deletion handled separately)',
    v_target_email,
    COALESCE(array_length(v_client_ids, 1), 0),
    COALESCE(array_length(v_hot_sheet_ids, 1), 0),
    COALESCE(array_length(v_auth_user_ids, 1), 0);
END $$;