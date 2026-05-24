-- Agent verification audit log
CREATE TABLE IF NOT EXISTS public.agent_verification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL,
  admin_user_id uuid,
  action text NOT NULL CHECK (action IN ('verified','rejected','restricted','reverted','pending')),
  previous_status text,
  new_status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_verification_audit_agent_idx
  ON public.agent_verification_audit(agent_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_verification_audit_admin_idx
  ON public.agent_verification_audit(admin_user_id, created_at DESC);

ALTER TABLE public.agent_verification_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit" ON public.agent_verification_audit;
CREATE POLICY "Admins read audit"
  ON public.agent_verification_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No insert/update/delete policies: only the SECURITY DEFINER trigger writes here.

-- Trigger: log status / verified_at changes on agent_settings
CREATE OR REPLACE FUNCTION public.log_agent_verification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_old_status text;
  v_new_status text;
BEGIN
  v_old_status := COALESCE(OLD.agent_status, 'pending');
  v_new_status := COALESCE(NEW.agent_status, 'pending');

  IF v_old_status IS DISTINCT FROM v_new_status
     OR (OLD.verified_at IS NULL) IS DISTINCT FROM (NEW.verified_at IS NULL) THEN

    IF NEW.verified_at IS NOT NULL AND (OLD.verified_at IS NULL) THEN
      v_action := 'verified';
    ELSIF NEW.verified_at IS NULL AND OLD.verified_at IS NOT NULL THEN
      v_action := 'reverted';
    ELSIF v_new_status = 'rejected' THEN
      v_action := 'rejected';
    ELSIF v_new_status = 'restricted' THEN
      v_action := 'restricted';
    ELSIF v_new_status = 'pending' THEN
      v_action := 'pending';
    ELSE
      v_action := v_new_status;
    END IF;

    INSERT INTO public.agent_verification_audit (
      agent_user_id, admin_user_id, action, previous_status, new_status
    ) VALUES (
      NEW.user_id, auth.uid(), v_action, v_old_status, v_new_status
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_agent_verification_change ON public.agent_settings;
CREATE TRIGGER trg_log_agent_verification_change
AFTER UPDATE ON public.agent_settings
FOR EACH ROW
EXECUTE FUNCTION public.log_agent_verification_change();