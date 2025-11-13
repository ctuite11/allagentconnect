-- Create table for coming soon email signups
CREATE TABLE IF NOT EXISTS public.coming_soon_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coming_soon_signups ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert their signup (public form)
CREATE POLICY "Anyone can signup for updates"
  ON public.coming_soon_signups
  FOR INSERT
  WITH CHECK (true);

-- Create index on email for faster lookups
CREATE INDEX idx_coming_soon_signups_email ON public.coming_soon_signups(email);