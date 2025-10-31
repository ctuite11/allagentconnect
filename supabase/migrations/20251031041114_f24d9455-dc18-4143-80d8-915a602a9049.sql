-- Create clients table for agents to manage their clients
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Agents can view their own clients
CREATE POLICY "Agents can view their own clients"
  ON public.clients FOR SELECT
  USING (auth.uid() = agent_id);

-- Agents can insert their own clients
CREATE POLICY "Agents can insert their own clients"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() = agent_id);

-- Agents can update their own clients
CREATE POLICY "Agents can update their own clients"
  ON public.clients FOR UPDATE
  USING (auth.uid() = agent_id);

-- Agents can delete their own clients
CREATE POLICY "Agents can delete their own clients"
  ON public.clients FOR DELETE
  USING (auth.uid() = agent_id);

-- Add client_id to hot_sheets table to link hot sheets to clients
ALTER TABLE public.hot_sheets
  ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX idx_clients_agent_id ON public.clients(agent_id);
CREATE INDEX idx_hot_sheets_client_id ON public.hot_sheets(client_id);

-- Trigger for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();