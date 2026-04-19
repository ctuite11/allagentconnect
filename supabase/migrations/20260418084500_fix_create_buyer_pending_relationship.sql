-- Align create-buyer relationship semantics with CRM-first onboarding.
-- Pending rows are CRM-linked (crm_client_id), auth client_id stays NULL until invite acceptance.

ALTER TABLE public.client_agent_relationships
  ALTER COLUMN client_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can create relationships" ON public.client_agent_relationships;

CREATE POLICY "Clients can create own relationships"
ON public.client_agent_relationships
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Agents can create pending CRM relationships"
ON public.client_agent_relationships
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = agent_id
  AND status = 'pending'
  AND client_id IS NULL
  AND crm_client_id IS NOT NULL
);

ALTER TABLE public.client_agent_relationships
  DROP CONSTRAINT IF EXISTS client_agent_relationships_status_linking_check;

ALTER TABLE public.client_agent_relationships
  ADD CONSTRAINT client_agent_relationships_status_linking_check
  CHECK (
    (status = 'active' AND client_id IS NOT NULL)
    OR (status = 'pending' AND client_id IS NULL AND crm_client_id IS NOT NULL)
    OR (status IN ('inactive', 'declined'))
  ) NOT VALID;
