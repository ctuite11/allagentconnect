
-- 1. Idempotent helper: guarantees a user has the 'agent' role
CREATE OR REPLACE FUNCTION public.ensure_agent_role_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'agent'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- 2. Trigger function on agent_settings insert
CREATE OR REPLACE FUNCTION public.tg_agent_settings_ensure_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_agent_role_for_user(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_settings_ensure_role ON public.agent_settings;
CREATE TRIGGER agent_settings_ensure_role
AFTER INSERT ON public.agent_settings
FOR EACH ROW
EXECUTE FUNCTION public.tg_agent_settings_ensure_role();

-- 3. One-time backfill: any agent_settings user lacking an 'agent' role gets one
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT s.user_id, 'agent'::app_role
FROM public.agent_settings s
WHERE s.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = s.user_id
      AND ur.role = 'agent'::app_role
  )
ON CONFLICT (user_id, role) DO NOTHING;
