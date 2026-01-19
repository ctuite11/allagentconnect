-- Add seller verification consent column to agent_match_submissions
ALTER TABLE public.agent_match_submissions
ADD COLUMN seller_verification_consent boolean NOT NULL DEFAULT false;