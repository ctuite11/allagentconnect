-- Trigger function to force-generate aac_id
CREATE OR REPLACE FUNCTION public.set_aac_id_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NEW.aac_id IS NULL OR NEW.aac_id = '' THEN
    NEW.aac_id := public.generate_aac_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any (idempotent)
DROP TRIGGER IF EXISTS set_aac_id_before_insert ON public.agent_profiles;

-- Create BEFORE INSERT trigger
CREATE TRIGGER set_aac_id_before_insert
BEFORE INSERT ON public.agent_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_aac_id_on_insert();