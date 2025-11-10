-- Create email campaigns table to group bulk emails
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  recipient_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create email sends table to track individual emails
CREATE TABLE IF NOT EXISTS public.email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create email opens table
CREATE TABLE IF NOT EXISTS public.email_opens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_send_id UUID NOT NULL REFERENCES public.email_sends(id) ON DELETE CASCADE,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create email clicks table
CREATE TABLE IF NOT EXISTS public.email_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_send_id UUID NOT NULL REFERENCES public.email_sends(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  url TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_opens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_clicks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_campaigns
CREATE POLICY "Agents can view their own campaigns"
  ON public.email_campaigns FOR SELECT
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents can create campaigns"
  ON public.email_campaigns FOR INSERT
  WITH CHECK (auth.uid() = agent_id);

-- RLS Policies for email_sends
CREATE POLICY "Agents can view sends from their campaigns"
  ON public.email_sends FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_campaigns
      WHERE id = email_sends.campaign_id
      AND agent_id = auth.uid()
    )
  );

CREATE POLICY "System can insert email sends"
  ON public.email_sends FOR INSERT
  WITH CHECK (true);

-- RLS Policies for email_opens
CREATE POLICY "Agents can view opens from their campaigns"
  ON public.email_opens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_sends es
      JOIN public.email_campaigns ec ON ec.id = es.campaign_id
      WHERE es.id = email_opens.email_send_id
      AND ec.agent_id = auth.uid()
    )
  );

CREATE POLICY "Public can insert opens"
  ON public.email_opens FOR INSERT
  WITH CHECK (true);

-- RLS Policies for email_clicks
CREATE POLICY "Agents can view clicks from their campaigns"
  ON public.email_clicks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_sends es
      JOIN public.email_campaigns ec ON ec.id = es.campaign_id
      WHERE es.id = email_clicks.email_send_id
      AND ec.agent_id = auth.uid()
    )
  );

CREATE POLICY "Public can insert clicks"
  ON public.email_clicks FOR INSERT
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_email_sends_campaign ON public.email_sends(campaign_id);
CREATE INDEX idx_email_opens_send ON public.email_opens(email_send_id);
CREATE INDEX idx_email_clicks_send ON public.email_clicks(email_send_id);