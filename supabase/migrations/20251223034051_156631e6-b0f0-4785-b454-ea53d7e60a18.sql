-- Create deleted_users table to archive deleted agent information
CREATE TABLE public.deleted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  company text,
  deleted_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_by uuid,
  deletion_reason text,
  original_data jsonb
);

-- Enable RLS
ALTER TABLE public.deleted_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view deleted users
CREATE POLICY "Admins can view deleted users"
ON public.deleted_users
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert deleted users (when archiving)
CREATE POLICY "Admins can insert deleted users"
ON public.deleted_users
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete from archive (permanent removal)
CREATE POLICY "Admins can delete from archive"
ON public.deleted_users
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));