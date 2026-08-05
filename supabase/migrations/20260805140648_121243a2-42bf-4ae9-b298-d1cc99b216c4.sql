CREATE OR REPLACE FUNCTION public.find_current_agent_deletion(p_email text)
RETURNS TABLE (
  id uuid,
  original_user_id uuid,
  email text,
  first_name text,
  last_name text,
  deleted_at timestamptz,
  deleted_by uuid,
  deletion_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH target AS (
    SELECT lower(btrim(p_email)) AS email_norm
  ), current_auth AS (
    SELECT u.id, u.created_at
    FROM auth.users u, target t
    WHERE lower(u.email) = t.email_norm
    ORDER BY u.created_at DESC
    LIMIT 1
  )
  SELECT d.id,
         d.original_user_id,
         d.email,
         d.first_name,
         d.last_name,
         d.deleted_at,
         d.deleted_by,
         d.deletion_reason
  FROM public.deleted_users d
  CROSS JOIN target t
  LEFT JOIN current_auth a ON true
  WHERE lower(btrim(d.email)) = t.email_norm
    AND (
      a.id IS NULL
      OR d.original_user_id = a.id
      OR d.deleted_at >= a.created_at
    )
  ORDER BY d.deleted_at DESC
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.find_current_agent_deletion(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_current_agent_deletion(text) FROM anon;
REVOKE ALL ON FUNCTION public.find_current_agent_deletion(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.find_current_agent_deletion(text) TO service_role;