
REVOKE ALL ON public.agent_presence FROM PUBLIC, anon;
GRANT SELECT ON public.agent_presence TO authenticated;
