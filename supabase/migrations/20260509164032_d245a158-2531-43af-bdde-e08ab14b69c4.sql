
ALTER VIEW public.v_email_job_engagement SET (security_invoker = on);
ALTER VIEW public.v_email_unsubscribes_status SET (security_invoker = on);
REVOKE ALL ON public.v_email_job_engagement FROM anon, authenticated;
REVOKE ALL ON public.v_email_unsubscribes_status FROM anon, authenticated;
