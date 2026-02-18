
-- resolve_user_role(): single authoritative role resolution
-- Priority: admin > buyer > agent > unknown
-- Returns role + is_verified_agent for agent routing

CREATE OR REPLACE FUNCTION public.resolve_user_role(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin  boolean;
  v_is_buyer  boolean;
  v_is_agent  boolean;
  v_verified  boolean;
BEGIN
  -- Priority 1: admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN jsonb_build_object('role', 'admin', 'is_verified_agent', false);
  END IF;

  -- Priority 2: buyer (buyer always wins over agent status checks)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'buyer'
  ) INTO v_is_buyer;

  IF v_is_buyer THEN
    RETURN jsonb_build_object('role', 'buyer', 'is_verified_agent', false);
  END IF;

  -- Priority 3: agent
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'agent'
  ) INTO v_is_agent;

  IF v_is_agent THEN
    SELECT EXISTS (
      SELECT 1 FROM public.agent_settings
      WHERE user_id = _user_id AND agent_status = 'verified'
    ) INTO v_verified;

    RETURN jsonb_build_object('role', 'agent', 'is_verified_agent', COALESCE(v_verified, false));
  END IF;

  -- Fallback: unknown (no role assigned yet)
  RETURN jsonb_build_object('role', 'unknown', 'is_verified_agent', false);
END;
$$;

-- Grant execute to authenticated users (they can only resolve their own role
-- since callers must pass the userId, and server-side callers use service role)
GRANT EXECUTE ON FUNCTION public.resolve_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_user_role(uuid) TO anon;
