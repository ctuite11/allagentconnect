CREATE OR REPLACE FUNCTION public.create_buyer_hot_sheet(
  p_name text,
  p_criteria jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_buyer_id uuid := auth.uid();
  v_agent_id uuid;
  v_crm_client_id uuid;
  v_hot_sheet_id uuid;
BEGIN
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT car.agent_id, car.crm_client_id
    INTO v_agent_id, v_crm_client_id
  FROM public.client_agent_relationships car
  WHERE car.client_id = v_buyer_id
    AND car.status = 'active'
    AND car.ended_at IS NULL
    AND car.crm_client_id IS NOT NULL
  ORDER BY car.created_at DESC
  LIMIT 1;

  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'No active agent relationship';
  END IF;

  IF v_crm_client_id IS NULL THEN
    RAISE EXCEPTION 'No CRM client record linked to this buyer-agent relationship';
  END IF;

  INSERT INTO public.hot_sheets (
    user_id,
    client_id,
    name,
    criteria,
    is_active,
    notify_client_email,
    notify_agent_email,
    notification_schedule
  ) VALUES (
    v_agent_id,
    v_crm_client_id,
    p_name,
    p_criteria,
    true,
    true,
    true,
    'immediately'
  )
  RETURNING id INTO v_hot_sheet_id;

  INSERT INTO public.hot_sheet_clients (hot_sheet_id, client_id)
  VALUES (v_hot_sheet_id, v_crm_client_id)
  ON CONFLICT DO NOTHING;

  RETURN v_hot_sheet_id;
END;
$$;