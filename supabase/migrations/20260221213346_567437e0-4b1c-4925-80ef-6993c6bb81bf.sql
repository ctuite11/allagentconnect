
-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- CLIENTS
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
CREATE POLICY "Admins can view all clients"
ON public.clients
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
