-- Drop the old broken RLS policy
DROP POLICY IF EXISTS "Buyers and matched agents can view buyer needs" ON client_needs;

-- Create new policy: All authenticated users (agents) can view all client needs
CREATE POLICY "All authenticated users can view client needs"
  ON client_needs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Keep the policy for submitting client needs
-- (Policy already exists: "Agents can insert buyer needs")