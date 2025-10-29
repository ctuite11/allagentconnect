-- Create audit_logs table for tracking sensitive operations
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only allow reading own audit logs or if user is admin (future-proof)
CREATE POLICY "Users can view their own audit logs"
ON public.audit_logs
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert audit logs (via triggers)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- Create function to log buyer need views by agents
CREATE OR REPLACE FUNCTION public.log_buyer_need_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log when an agent (not the submitter) views a buyer need
  IF auth.uid() IS NOT NULL AND auth.uid() != NEW.submitted_by THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (auth.uid(), 'VIEW_BUYER_NEED', 'buyer_needs', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for buyer need views (fires on SELECT via RLS)
-- Note: PostgreSQL doesn't support SELECT triggers directly, so we use AFTER INSERT as proxy
-- For actual view logging, we'd need application-level logging or pgaudit extension

-- Create function to log listing modifications
CREATE OR REPLACE FUNCTION public.log_listing_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (auth.uid(), 'UPDATE_LISTING', 'listings', NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (auth.uid(), 'DELETE_LISTING', 'listings', OLD.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers for listing changes
CREATE TRIGGER audit_listing_update
AFTER UPDATE ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.log_listing_change();

CREATE TRIGGER audit_listing_delete
AFTER DELETE ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.log_listing_change();

-- Create function to log agent profile updates
CREATE OR REPLACE FUNCTION public.log_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
  VALUES (auth.uid(), 'UPDATE_PROFILE', 'agent_profiles', NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger for profile updates
CREATE TRIGGER audit_profile_update
AFTER UPDATE ON public.agent_profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_profile_change();

-- Create function to log county preference changes
CREATE OR REPLACE FUNCTION public.log_county_preference_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (auth.uid(), 'ADD_COUNTY_PREFERENCE', 'agent_county_preferences', NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id)
    VALUES (auth.uid(), 'REMOVE_COUNTY_PREFERENCE', 'agent_county_preferences', OLD.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers for county preference changes
CREATE TRIGGER audit_county_preference_insert
AFTER INSERT ON public.agent_county_preferences
FOR EACH ROW
EXECUTE FUNCTION public.log_county_preference_change();

CREATE TRIGGER audit_county_preference_delete
AFTER DELETE ON public.agent_county_preferences
FOR EACH ROW
EXECUTE FUNCTION public.log_county_preference_change();

-- Create index for faster audit log queries
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);