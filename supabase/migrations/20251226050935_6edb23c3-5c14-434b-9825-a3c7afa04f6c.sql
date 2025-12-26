-- Create pending_verifications table as a fallback for when edge function fails
CREATE TABLE public.pending_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  license_state TEXT,
  license_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processed_by UUID
);

-- Enable RLS
ALTER TABLE public.pending_verifications ENABLE ROW LEVEL SECURITY;

-- Allow inserts from authenticated users (for their own user_id)
CREATE POLICY "Users can insert their own pending verification"
ON public.pending_verifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all pending verifications
CREATE POLICY "Admins can view all pending verifications"
ON public.pending_verifications
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update pending verifications
CREATE POLICY "Admins can update pending verifications"
ON public.pending_verifications
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));