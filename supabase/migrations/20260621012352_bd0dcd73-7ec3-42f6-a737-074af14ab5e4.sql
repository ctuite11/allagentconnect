-- Tighten buyer_credentials SELECT access
-- Replace broad verified-credential policy with relationship-scoped + admin policies

DROP POLICY IF EXISTS "Agents can view buyer credentials in context" ON public.buyer_credentials;

CREATE POLICY "Linked active agents can view buyer credentials"
ON public.buyer_credentials
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_agent_relationships car
    WHERE car.client_id = buyer_credentials.user_id
      AND car.agent_id = auth.uid()
      AND car.status = 'active'
  )
);

CREATE POLICY "Admins can view buyer credentials"
ON public.buyer_credentials
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
