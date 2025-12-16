-- Fix search_path for the function
CREATE OR REPLACE FUNCTION public.set_agent_settings_updated_at()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;