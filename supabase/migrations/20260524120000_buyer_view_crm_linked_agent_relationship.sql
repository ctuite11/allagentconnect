-- Buyers with accepted invites may still have CRM-only relationship rows (client_id NULL)
-- until activate_agent_relationship runs; allow SELECT when CRM email matches auth profile.

DROP POLICY IF EXISTS "Clients can view CRM-linked relationships by email" ON public.client_agent_relationships;

CREATE POLICY "Clients can view CRM-linked relationships by email"
ON public.client_agent_relationships
FOR SELECT
TO authenticated
USING (
  client_id IS NULL
  AND status IN ('active', 'pending')
  AND ended_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.clients cl
    INNER JOIN public.profiles pf ON pf.id = auth.uid()
    WHERE cl.id = client_agent_relationships.crm_client_id
      AND lower(btrim(cl.email)) = lower(btrim(pf.email))
  )
);
