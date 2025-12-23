-- Add policy to allow admins to update any agent_settings record
CREATE POLICY "Admins can update all agent settings" 
ON public.agent_settings
FOR UPDATE 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);

-- Add policy for admins to SELECT any agent_settings (to see all agents)
CREATE POLICY "Admins can read all agent settings"
ON public.agent_settings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
);