ALTER TABLE public.client_agent_relationships
  DROP CONSTRAINT IF EXISTS client_agent_relationships_crm_client_id_fkey;

ALTER TABLE public.client_agent_relationships
  ADD CONSTRAINT client_agent_relationships_crm_client_id_fkey
  FOREIGN KEY (crm_client_id)
  REFERENCES public.clients(id)
  ON DELETE SET NULL;