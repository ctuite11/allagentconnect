-- Allow client_id to be null for pending-invite buyers (no auth user yet)
ALTER TABLE public.client_agent_relationships
  ALTER COLUMN client_id DROP NOT NULL;

-- Ensure at least one identifier is present
ALTER TABLE public.client_agent_relationships
  DROP CONSTRAINT IF EXISTS client_agent_relationships_identity_present;
ALTER TABLE public.client_agent_relationships
  ADD CONSTRAINT client_agent_relationships_identity_present
  CHECK (client_id IS NOT NULL OR crm_client_id IS NOT NULL);

-- Update single-active-agent trigger to skip rows with null client_id
CREATE OR REPLACE FUNCTION public.check_single_active_agent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'active' AND NEW.client_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM client_agent_relationships
      WHERE client_id = NEW.client_id
        AND status = 'active'
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Client can only have one active agent relationship at a time';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;