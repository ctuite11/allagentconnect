INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT m.user_id, 'developer'::public.app_role
FROM public.development_account_members m
WHERE m.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = m.user_id AND ur.role = 'developer'::public.app_role
  )
ON CONFLICT (user_id, role) DO NOTHING;