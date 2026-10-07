-- Revert out-of-scope Agent Network exception (added in 0031 this session; no callers remain).
DROP FUNCTION IF EXISTS public.add_network_agent_contact(uuid);