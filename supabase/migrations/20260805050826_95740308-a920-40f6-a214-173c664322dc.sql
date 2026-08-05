UPDATE public.hot_sheets SET is_active = false WHERE id = 'beb483e0-6125-40df-8532-15e53a3b4c59';

INSERT INTO public.hot_sheets (id, user_id, name, criteria, is_active, notification_schedule, notify_agent_email, notify_client_email)
SELECT '7f3a1c62-9d4e-4b18-a0c5-2e6b81f4d900'::uuid, user_id, 'CANARY RENDER 2 (temp)', criteria, true, 'immediately', true, false
FROM public.hot_sheets WHERE id = 'beb483e0-6125-40df-8532-15e53a3b4c59';