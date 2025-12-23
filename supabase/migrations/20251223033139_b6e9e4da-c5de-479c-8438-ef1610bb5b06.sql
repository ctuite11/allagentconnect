-- Add policy for admins to INSERT agent_settings records
CREATE POLICY "Admins can insert agent settings"
ON public.agent_settings
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);