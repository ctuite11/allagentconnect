
-- Create agent_license_uploads table
CREATE TABLE public.agent_license_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_license_uploads ENABLE ROW LEVEL SECURITY;

-- Agents can insert their own uploads
CREATE POLICY "Agents can insert own license uploads"
ON public.agent_license_uploads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Agents can read their own uploads
CREATE POLICY "Agents can read own license uploads"
ON public.agent_license_uploads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Admins can update any upload (status, notes)
CREATE POLICY "Admins can update license uploads"
ON public.agent_license_uploads
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER set_license_uploads_updated_at
BEFORE UPDATE ON public.agent_license_uploads
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-license-docs', 'agent-license-docs', false);

-- Storage: agents can upload to their own folder
CREATE POLICY "Agents upload own license docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agent-license-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage: agents can read their own files, admins can read all
CREATE POLICY "Read own or admin license docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agent-license-docs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);
