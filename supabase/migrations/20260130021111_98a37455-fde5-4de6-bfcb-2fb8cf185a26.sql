-- Add listing attribution columns to agent_early_access
ALTER TABLE public.agent_early_access
ADD COLUMN IF NOT EXISTS listing_id uuid NULL,
ADD COLUMN IF NOT EXISTS source text NULL,
ADD COLUMN IF NOT EXISTS registered_from_listing boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.agent_early_access.listing_id IS 'The listing UUID that drove this registration (if any)';
COMMENT ON COLUMN public.agent_early_access.source IS 'Traffic source: social, email, facebook, linkedin, sms, etc.';
COMMENT ON COLUMN public.agent_early_access.registered_from_listing IS 'True if registration was driven by a listing share link';