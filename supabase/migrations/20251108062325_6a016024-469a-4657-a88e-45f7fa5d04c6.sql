-- Create table for agent state preferences
CREATE TABLE IF NOT EXISTS agent_state_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(agent_id, state)
);

-- Enable RLS
ALTER TABLE agent_state_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agents can view their own state preferences"
  ON agent_state_preferences FOR SELECT
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents can insert their own state preferences"
  ON agent_state_preferences FOR INSERT
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can delete their own state preferences"
  ON agent_state_preferences FOR DELETE
  USING (auth.uid() = agent_id);

CREATE POLICY "Anyone can view all agent state preferences"
  ON agent_state_preferences FOR SELECT
  USING (true);

-- Create function to notify agents about new client needs
CREATE OR REPLACE FUNCTION notify_agents_of_client_need()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  -- Trigger edge function to send notifications
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/notify-agents-client-need',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'client_need_id', NEW.id,
      'state', NEW.state,
      'city', NEW.city,
      'property_type', NEW.property_type,
      'max_price', NEW.max_price,
      'bedrooms', NEW.bedrooms,
      'bathrooms', NEW.bathrooms,
      'description', NEW.description
    )
  ) INTO request_id;
  
  RAISE LOG 'Triggered client need notification for % with request_id %', NEW.id, request_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger client need notification for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on client_needs table
DROP TRIGGER IF EXISTS on_client_need_created ON client_needs;
CREATE TRIGGER on_client_need_created
  AFTER INSERT ON client_needs
  FOR EACH ROW
  EXECUTE FUNCTION notify_agents_of_client_need();