-- Rename the buyer_needs table to client_needs
ALTER TABLE buyer_needs RENAME TO client_needs;

-- Update the function that logs views to use new terminology
DROP FUNCTION IF EXISTS public.log_buyer_need_view();

CREATE OR REPLACE FUNCTION public.log_client_need_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only log when an agent (not the submitter) views a client need
  IF auth.uid() IS NOT NULL AND auth.uid() != NEW.submitted_by THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (auth.uid(), 'VIEW_CLIENT_NEED', 'client_needs', NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;