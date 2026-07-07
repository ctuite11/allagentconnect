DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'ben.snow@nemoves.com' LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User ben.snow@nemoves.com not found';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt('AacWelcome-DguVyTZtJv!', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = v_uid;

  UPDATE public.agent_settings
  SET account_activated_at = COALESCE(account_activated_at, now()),
      updated_at = now()
  WHERE user_id = v_uid;
END $$;