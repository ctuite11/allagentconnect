ALTER TABLE public.agent_settings
  ADD COLUMN IF NOT EXISTS account_activated_at timestamptz;

-- Conservative backfill: only mark active when there's a real auth signal
-- (the agent has signed in at least once AND is currently verified).
UPDATE public.agent_settings s
SET account_activated_at = u.last_sign_in_at
FROM auth.users u
WHERE s.user_id = u.id
  AND s.account_activated_at IS NULL
  AND s.agent_status = 'verified'
  AND u.last_sign_in_at IS NOT NULL;