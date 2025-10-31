-- Add incentives columns to agent_profiles table
ALTER TABLE public.agent_profiles 
ADD COLUMN buyer_incentives TEXT,
ADD COLUMN seller_incentives TEXT;