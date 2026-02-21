
-- Fix: make the view use SECURITY INVOKER so RLS of the querying user applies
ALTER VIEW public.clients_with_relationship_status SET (security_invoker = on);
