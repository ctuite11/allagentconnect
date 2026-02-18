
-- Allow admins to read all user_roles rows (fixes AdminConsumers page showing 0 results)
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
