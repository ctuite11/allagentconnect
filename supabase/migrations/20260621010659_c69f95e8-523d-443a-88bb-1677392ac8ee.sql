
-- 1. Drop the permissive self-insert policy
DROP POLICY IF EXISTS "System can insert user roles" ON public.user_roles;

-- 2. Tightly scoped helper for client-side signup flows.
--    Only allows non-privileged roles. Cannot be used to grant admin/moderator.
CREATE OR REPLACE FUNCTION public.assign_self_role(_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _role NOT IN ('agent', 'buyer') THEN
    RAISE EXCEPTION 'Role % cannot be self-assigned', _role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_self_role(public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_self_role(public.app_role) TO authenticated;
