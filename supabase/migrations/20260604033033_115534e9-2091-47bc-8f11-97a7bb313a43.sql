CREATE OR REPLACE FUNCTION public.accept_client_hot_sheet_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _user_email text;
  _user_email_lower text;
  _token_row public.share_tokens%ROWTYPE;
  _payload jsonb;
  _agent_id uuid;
  _crm_client_id uuid;
  _token_email text;
  _first_name text;
  _last_name text;
  _phone text;
  _relationship_id uuid;
  _dup_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT email INTO _user_email FROM auth.users WHERE id = _user_id;
  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
  _user_email_lower := lower(_user_email);

  SELECT * INTO _token_row FROM public.share_tokens WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'token_not_found';
  END IF;

  IF _token_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'token_revoked';
  END IF;

  _payload := COALESCE(_token_row.payload, '{}'::jsonb);
  IF (_payload->>'type') IS DISTINCT FROM 'client_hotsheet_invite' THEN
    RAISE EXCEPTION 'wrong_token_type';
  END IF;

  _agent_id := _token_row.agent_id;
  IF _agent_id IS NULL THEN
    RAISE EXCEPTION 'token_missing_agent';
  END IF;

  BEGIN
    _crm_client_id := NULLIF(_payload->>'client_id','')::uuid;
  EXCEPTION WHEN others THEN
    _crm_client_id := NULL;
  END;

  _token_email := lower(trim(COALESCE(_payload->>'client_email','')));

  -- Idempotency: token already accepted
  IF _token_row.accepted_at IS NOT NULL THEN
    IF _token_row.accepted_by_user_id IS NOT NULL
       AND _token_row.accepted_by_user_id IS DISTINCT FROM _user_id THEN
      RAISE EXCEPTION 'token_already_accepted';
    END IF;
    -- same buyer re-accepting → fall through and ensure downstream state
  END IF;

  -- Email guard: invite must be claimed with the invited email
  IF _token_email <> '' AND _user_email_lower <> _token_email THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  _first_name := NULLIF(trim(COALESCE(_payload->>'client_first_name','')), '');
  _last_name  := NULLIF(trim(COALESCE(_payload->>'client_last_name','')),  '');
  _phone      := NULLIF(trim(COALESCE(_payload->>'client_phone','')),       '');

  -- Upsert buyer profile
  INSERT INTO public.profiles (id, email, first_name, last_name, phone, updated_at)
  VALUES (_user_id, _user_email_lower, _first_name, _last_name, _phone, now())
  ON CONFLICT (id) DO UPDATE
  SET email      = EXCLUDED.email,
      first_name = COALESCE(public.profiles.first_name, EXCLUDED.first_name),
      last_name  = COALESCE(public.profiles.last_name,  EXCLUDED.last_name),
      phone      = COALESCE(public.profiles.phone,      EXCLUDED.phone),
      updated_at = now();

  -- Assign buyer role idempotently
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'buyer'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Find existing relationship row to reuse (prefer crm bridge, else (client_id, agent_id))
  IF _crm_client_id IS NOT NULL THEN
    SELECT id INTO _relationship_id
    FROM public.client_agent_relationships
    WHERE agent_id = _agent_id
      AND crm_client_id = _crm_client_id
    ORDER BY (status = 'active') DESC, created_at DESC
    LIMIT 1;
  END IF;

  IF _relationship_id IS NULL THEN
    SELECT id INTO _relationship_id
    FROM public.client_agent_relationships
    WHERE agent_id = _agent_id
      AND client_id = _user_id
    LIMIT 1;
  END IF;

  -- End any OTHER active relationships for this buyer (one-active-agent rule)
  UPDATE public.client_agent_relationships
  SET status = 'inactive', ended_at = now()
  WHERE client_id = _user_id
    AND ended_at IS NULL
    AND status = 'active'
    AND id IS DISTINCT FROM _relationship_id;

  -- If a duplicate (client_id, agent_id) row exists that is NOT the chosen relationship,
  -- collapse it before reassigning client_id to avoid violating the unique key.
  IF _relationship_id IS NOT NULL THEN
    SELECT id INTO _dup_id
    FROM public.client_agent_relationships
    WHERE agent_id = _agent_id
      AND client_id = _user_id
      AND id IS DISTINCT FROM _relationship_id
    LIMIT 1;

    IF _dup_id IS NOT NULL THEN
      DELETE FROM public.client_agent_relationships WHERE id = _dup_id;
    END IF;

    UPDATE public.client_agent_relationships
    SET status           = 'active',
        ended_at         = NULL,
        client_id        = _user_id,
        crm_client_id    = COALESCE(_crm_client_id, crm_client_id),
        invitation_token = COALESCE(invitation_token, _token)
    WHERE id = _relationship_id;
  ELSE
    INSERT INTO public.client_agent_relationships
      (client_id, agent_id, status, created_at, crm_client_id, invitation_token)
    VALUES
      (_user_id, _agent_id, 'active', now(), _crm_client_id, _token)
    RETURNING id INTO _relationship_id;
  END IF;

  -- Mark token accepted (idempotent)
  UPDATE public.share_tokens
  SET accepted_at         = COALESCE(accepted_at, now()),
      accepted_by_user_id = COALESCE(accepted_by_user_id, _user_id)
  WHERE id = _token_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'relationship_id', _relationship_id,
    'agent_id', _agent_id,
    'crm_client_id', _crm_client_id,
    'token_id', _token_row.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_client_hot_sheet_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_client_hot_sheet_invite(text) TO authenticated;