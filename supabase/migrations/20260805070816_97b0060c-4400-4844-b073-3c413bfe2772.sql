CREATE OR REPLACE FUNCTION public.install_email_dispatch_service_role_key(p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) < 20 THEN
    RAISE EXCEPTION 'install_email_dispatch_service_role_key: refusing empty/short key';
  END IF;

  SELECT s.id INTO v_id FROM vault.secrets s WHERE s.name = 'email_dispatch_service_role_key' LIMIT 1;

  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_key, 'email_dispatch_service_role_key', 'Service-role key used only by public.invoke_process_email_queue() and public.dispatch_hot_sheet_listing()');
    RETURN 'created';
  ELSE
    PERFORM vault.update_secret(v_id, p_key);
    RETURN 'updated';
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.install_email_dispatch_service_role_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.install_email_dispatch_service_role_key(text) FROM anon;
REVOKE ALL ON FUNCTION public.install_email_dispatch_service_role_key(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.install_email_dispatch_service_role_key(text) TO service_role;