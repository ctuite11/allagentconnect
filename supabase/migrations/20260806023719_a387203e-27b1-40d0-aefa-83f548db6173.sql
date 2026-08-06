DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Users can insert their own audit logs"
ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
REVOKE INSERT ON public.audit_logs FROM anon;