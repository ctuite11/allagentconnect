CREATE OR REPLACE FUNCTION public.probe_email_dispatch_secret()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE v text;
BEGIN
  SELECT ds.decrypted_secret INTO v FROM vault.decrypted_secrets ds
  WHERE ds.name = 'email_dispatch_service_role_key' LIMIT 1;
  RETURN jsonb_build_object(
    'present', v IS NOT NULL,
    'nonempty', coalesce(length(trim(coalesce(v,''))) > 0, false),
    'len', coalesce(length(v), 0),
    'md5', md5(coalesce(v,'')),
    'role_claim', CASE WHEN v IS NULL THEN NULL ELSE
      (convert_from(decode(rpad(translate(split_part(v,'.',2),'-_','+/'), (length(split_part(v,'.',2)) + 3) / 4 * 4, '='),'base64'),'UTF8')::jsonb ->> 'role') END
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.probe_email_dispatch_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.probe_email_dispatch_secret() TO service_role;