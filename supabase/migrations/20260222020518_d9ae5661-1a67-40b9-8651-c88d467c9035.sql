
-- 1. Add deactivated_at column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- 2. Create admin_deactivate_buyer RPC (returns jsonb summary)
CREATE OR REPLACE FUNCTION public.admin_deactivate_buyer(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_roles_deleted int := 0;
  v_relationships_ended int := 0;
  v_profile_updated int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- 1) Remove buyer role
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role = 'buyer';
  GET DIAGNOSTICS v_roles_deleted = ROW_COUNT;

  -- 2) End all active relationships
  UPDATE public.client_agent_relationships
  SET status = 'inactive', ended_at = now()
  WHERE client_id = p_user_id AND status = 'active';
  GET DIAGNOSTICS v_relationships_ended = ROW_COUNT;

  -- 3) Soft-deactivate profile
  UPDATE public.profiles
  SET deactivated_at = now()
  WHERE id = p_user_id;
  GET DIAGNOSTICS v_profile_updated = ROW_COUNT;

  -- IMPORTANT: Do NOT touch public.clients (CRM contacts)

  RETURN jsonb_build_object(
    'roles_deleted', v_roles_deleted,
    'relationships_ended', v_relationships_ended,
    'profile_updated', v_profile_updated
  );
END;
$$;
