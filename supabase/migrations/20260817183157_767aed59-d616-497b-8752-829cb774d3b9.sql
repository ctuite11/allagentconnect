CREATE TABLE public.comms_broadcast_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.comms_broadcasts(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  path text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('image','video')),
  mime_type text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT 'attachment',
  size_bytes bigint NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comms_broadcast_attachments_broadcast
  ON public.comms_broadcast_attachments (broadcast_id, sort_order);

GRANT SELECT, INSERT, DELETE ON public.comms_broadcast_attachments TO authenticated;
GRANT ALL ON public.comms_broadcast_attachments TO service_role;

ALTER TABLE public.comms_broadcast_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated agents can view broadcast attachments"
  ON public.comms_broadcast_attachments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Senders can add their own broadcast attachments"
  ON public.comms_broadcast_attachments FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Senders can delete their own broadcast attachments"
  ON public.comms_broadcast_attachments FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- Storage policies for the private comms-attachments bucket.
CREATE POLICY "comms_attachments_insert_own_folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comms-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "comms_attachments_update_own_folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'comms-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'comms-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "comms_attachments_delete_own_folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comms-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "comms_attachments_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comms-attachments');