-- Add approval_email_sent flag to prevent duplicate emails
ALTER TABLE public.agent_settings 
ADD COLUMN IF NOT EXISTS approval_email_sent boolean NOT NULL DEFAULT false;