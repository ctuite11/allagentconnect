
-- 1) Admin-only RPC for client deletion (transactional, FK-safe)
CREATE OR REPLACE FUNCTION public.admin_delete_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Enforce admin using existing role system
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- FK-safe deletion order
  DELETE FROM public.hot_sheet_clients
  WHERE client_id = p_client_id;

  DELETE FROM public.client_agent_relationships
  WHERE client_id = p_client_id;

  DELETE FROM public.clients
  WHERE id = p_client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_client(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_client(uuid) TO authenticated;

-- 2) Delete test client tuite.chris@gmail.com
DELETE FROM public.hot_sheet_clients
WHERE id IN (
  'b4ac8746-1062-4405-a369-b353412ae2fe'::uuid,
  '86a49bab-8e7a-491c-bf22-f412ba57a12c'::uuid
);

DELETE FROM public.clients
WHERE id = '12bf25c9-32d4-4463-bff3-ae6fed96c92e'::uuid
  AND lower(trim(email)) = lower(trim('tuite.chris@gmail.com'));
