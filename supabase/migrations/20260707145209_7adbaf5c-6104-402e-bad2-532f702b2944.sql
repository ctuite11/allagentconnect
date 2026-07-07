UPDATE public.agent_settings s
SET account_activated_at = COALESCE(u.confirmed_at, u.email_confirmed_at, u.last_sign_in_at),
    updated_at = now()
FROM auth.users u
WHERE u.id = s.user_id
  AND s.account_activated_at IS NULL
  AND u.email_confirmed_at IS NOT NULL
  AND u.last_sign_in_at IS NOT NULL;