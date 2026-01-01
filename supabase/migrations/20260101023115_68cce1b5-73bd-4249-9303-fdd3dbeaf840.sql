-- Create the agent_early_access table
CREATE TABLE public.agent_early_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  brokerage text NOT NULL,
  state text NOT NULL,
  license_number text NOT NULL,
  markets text,
  specialties text[],
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  verified_by uuid,
  founding_partner boolean NOT NULL DEFAULT false,
  notes text,
  CONSTRAINT agent_early_access_email_unique UNIQUE (email),
  CONSTRAINT agent_early_access_status_check CHECK (status IN ('pending', 'verified', 'rejected'))
);

-- Create case-insensitive index on email
CREATE UNIQUE INDEX agent_early_access_email_lower_idx ON public.agent_early_access (LOWER(email));

-- Enable RLS
ALTER TABLE public.agent_early_access ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (public registration)
CREATE POLICY "Anyone can register for early access"
ON public.agent_early_access
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy: Only admins can read all registrations
CREATE POLICY "Admins can view all registrations"
ON public.agent_early_access
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Policy: Only admins can update registrations
CREATE POLICY "Admins can update registrations"
ON public.agent_early_access
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Only admins can delete registrations
CREATE POLICY "Admins can delete registrations"
ON public.agent_early_access
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create function to count verified agents for founding partner logic
CREATE OR REPLACE FUNCTION public.get_verified_early_access_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.agent_early_access
  WHERE status = 'verified'
$$;