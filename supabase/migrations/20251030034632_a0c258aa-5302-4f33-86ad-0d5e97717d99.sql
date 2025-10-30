-- Create showing_requests table
CREATE TABLE public.showing_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_phone TEXT,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.showing_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert showing requests
CREATE POLICY "Anyone can create showing requests"
ON public.showing_requests
FOR INSERT
WITH CHECK (true);

-- Agents can view requests for their listings
CREATE POLICY "Agents can view showing requests for their listings"
ON public.showing_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.listings
    WHERE listings.id = showing_requests.listing_id
    AND listings.agent_id = auth.uid()
  )
);

-- Agents can update requests for their listings
CREATE POLICY "Agents can update showing requests for their listings"
ON public.showing_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.listings
    WHERE listings.id = showing_requests.listing_id
    AND listings.agent_id = auth.uid()
  )
);

-- Create updated_at trigger
CREATE TRIGGER update_showing_requests_updated_at
BEFORE UPDATE ON public.showing_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create agent_messages table for contact agent feature
CREATE TABLE public.agent_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert messages
CREATE POLICY "Anyone can send messages to agents"
ON public.agent_messages
FOR INSERT
WITH CHECK (true);

-- Agents can view their messages
CREATE POLICY "Agents can view their own messages"
ON public.agent_messages
FOR SELECT
USING (auth.uid() = agent_id);