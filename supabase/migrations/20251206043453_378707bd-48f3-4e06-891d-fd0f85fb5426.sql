-- Add header background customization fields to agent_profiles
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS header_background_type text DEFAULT 'gradient',
ADD COLUMN IF NOT EXISTS header_background_value text DEFAULT 'blue-indigo',
ADD COLUMN IF NOT EXISTS header_image_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.agent_profiles.header_background_type IS 'Type of header background: image, gradient, or pattern';
COMMENT ON COLUMN public.agent_profiles.header_background_value IS 'Value for gradient or pattern name';
COMMENT ON COLUMN public.agent_profiles.header_image_url IS 'URL for uploaded header image';