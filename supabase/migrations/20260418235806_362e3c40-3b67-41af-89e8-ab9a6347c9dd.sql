CREATE POLICY "Agents can create their own client relationships"
ON public.client_agent_relationships
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Agents can update their own client relationships"
ON public.client_agent_relationships
FOR UPDATE TO authenticated
USING (auth.uid() = agent_id)
WITH CHECK (auth.uid() = agent_id);