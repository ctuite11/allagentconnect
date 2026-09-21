-- The listings trigger enforce_listing_dcmls_participation() runs as the calling
-- role and calls public.agent_dcmls_participating(uuid), which had no EXECUTE
-- grant for app roles. Result: every listing save by an agent failed with
-- "permission denied for function agent_dcmls_participating".
-- The function is SECURITY DEFINER and returns only a boolean participation flag.
GRANT EXECUTE ON FUNCTION public.agent_dcmls_participating(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_dcmls_participating(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.agent_dcmls_participating(uuid) TO service_role;