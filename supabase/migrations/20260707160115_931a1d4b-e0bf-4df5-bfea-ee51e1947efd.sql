DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'melanie@gundersheimgroup.com';
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  UPDATE auth.users
  SET encrypted_password = crypt('AacWelcome-Mg7Kp2Qx9Vn!', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.agent_settings
  SET account_activated_at = COALESCE(account_activated_at, now()),
      updated_at = now()
  WHERE user_id = v_user_id;
END $$;