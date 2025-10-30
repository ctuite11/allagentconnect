-- Add bio and social links to agent_profiles
ALTER TABLE public.agent_profiles 
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{"linkedin": "", "twitter": "", "facebook": "", "instagram": "", "website": ""}'::jsonb;

-- Create testimonials table
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_title text,
  testimonial_text text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on testimonials
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Agents can manage their own testimonials
CREATE POLICY "Agents can view their own testimonials"
ON public.testimonials
FOR SELECT
USING (auth.uid() = agent_id);

CREATE POLICY "Agents can insert their own testimonials"
ON public.testimonials
FOR INSERT
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can update their own testimonials"
ON public.testimonials
FOR UPDATE
USING (auth.uid() = agent_id);

CREATE POLICY "Agents can delete their own testimonials"
ON public.testimonials
FOR DELETE
USING (auth.uid() = agent_id);

-- Anyone can view testimonials (for public agent profiles)
CREATE POLICY "Anyone can view all testimonials"
ON public.testimonials
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_testimonials_updated_at
BEFORE UPDATE ON public.testimonials
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();