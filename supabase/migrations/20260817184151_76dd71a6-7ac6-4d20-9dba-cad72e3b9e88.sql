-- Restrict Comms Center broadcast attachment reads to eligible AAC agents
-- (verified + activated) via the canonical helper, instead of any authenticated
-- user. Senders may always read their own rows/objects.

DROP POLICY IF EXISTS "Authenticated agents can view broadcast attachments" ON public.comms_broadcast_attachments;

CREATE POLICY "Eligible agents can view broadcast attachments"
  ON public.comms_broadcast_attachments FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.current_is_eligible_agent()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "comms_attachments_select_authenticated" ON storage.objects;

CREATE POLICY "comms_attachments_select_eligible_agents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'comms-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.current_is_eligible_agent()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );