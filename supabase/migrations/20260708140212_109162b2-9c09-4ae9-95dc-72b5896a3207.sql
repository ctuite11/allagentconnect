ALTER VIEW public.conversation_inbox SET (security_invoker = on);
GRANT SELECT ON public.conversation_inbox TO authenticated;
REVOKE SELECT ON public.conversation_inbox FROM anon;