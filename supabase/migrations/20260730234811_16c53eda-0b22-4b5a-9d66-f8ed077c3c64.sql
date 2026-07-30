
CREATE OR REPLACE FUNCTION public.guard_agent_settings_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), (current_setting('request.jwt.claims', true)::json ->> 'role'), '');
BEGIN
  IF uid IS NULL OR jwt_role = 'service_role' OR public.has_role(uid, 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.agent_status IS DISTINCT FROM OLD.agent_status
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.account_activated_at IS DISTINCT FROM OLD.account_activated_at
     OR NEW.verification_method IS DISTINCT FROM OLD.verification_method
     OR NEW.verification_payload IS DISTINCT FROM OLD.verification_payload
     OR NEW.verification_attempt_count IS DISTINCT FROM OLD.verification_attempt_count
     OR NEW.last_verification_attempt_at IS DISTINCT FROM OLD.last_verification_attempt_at
     OR NEW.approval_email_sent IS DISTINCT FROM OLD.approval_email_sent
  THEN
    RAISE EXCEPTION 'Agents cannot modify verification/activation lifecycle fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_agent_settings_lifecycle_update ON public.agent_settings;
CREATE TRIGGER guard_agent_settings_lifecycle_update
BEFORE UPDATE ON public.agent_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_agent_settings_lifecycle();

CREATE OR REPLACE FUNCTION public.guard_agent_settings_lifecycle_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), (current_setting('request.jwt.claims', true)::json ->> 'role'), '');
BEGIN
  IF uid IS NULL OR jwt_role = 'service_role' OR public.has_role(uid, 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.agent_status := 'pending';
  NEW.verified_at := NULL;
  NEW.account_activated_at := NULL;
  NEW.approval_email_sent := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_agent_settings_lifecycle_insert ON public.agent_settings;
CREATE TRIGGER guard_agent_settings_lifecycle_insert
BEFORE INSERT ON public.agent_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_agent_settings_lifecycle_insert();

DROP POLICY IF EXISTS "Users can update own settings" ON public.agent_settings;
CREATE POLICY "Users can update own settings"
ON public.agent_settings
FOR UPDATE
USING (user_id = public.current_account_owner_id())
WITH CHECK (user_id = public.current_account_owner_id());

COMMENT ON TABLE public.agent_settings IS
  'Agent settings. Verification/activation lifecycle fields are write-protected by guard_agent_settings_lifecycle(): only admins or service-role/backend contexts may change them.';

DROP POLICY IF EXISTS "private email attachments read own" ON storage.objects;
CREATE POLICY "private email attachments read own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'email-attachments-private' AND owner = auth.uid());

DROP POLICY IF EXISTS "private email attachments insert own" ON storage.objects;
CREATE POLICY "private email attachments insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'email-attachments-private' AND owner = auth.uid());

DROP POLICY IF EXISTS "private email attachments delete own" ON storage.objects;
CREATE POLICY "private email attachments delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'email-attachments-private' AND owner = auth.uid());
