
CREATE OR REPLACE FUNCTION public.check_client_has_other_agent(p_client_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_agent_relationships car
    JOIN public.clients c ON c.id = car.client_id
    WHERE lower(trim(c.email)) = lower(trim(p_client_email))
      AND car.status = 'active'
      AND car.agent_id <> auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.check_client_has_other_agent(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_client_has_other_agent(text) TO authenticated;

CREATE INDEX IF NOT EXISTS clients_email_normalized_idx
  ON public.clients (lower(trim(email)));

CREATE INDEX IF NOT EXISTS car_client_status_agent_idx
  ON public.client_agent_relationships (client_id, status, agent_id);
