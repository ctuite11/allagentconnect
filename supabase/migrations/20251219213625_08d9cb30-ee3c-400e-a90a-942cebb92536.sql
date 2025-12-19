-- Add 'rejected' to the agent_status enum
ALTER TYPE public.agent_status ADD VALUE IF NOT EXISTS 'rejected';