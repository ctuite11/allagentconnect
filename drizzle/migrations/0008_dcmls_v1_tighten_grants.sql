-- Read-only for public callers: the gated view is auto-updatable and runs with
-- owner rights, so writes through it must be revoked. The audit trail is
-- append-only by triggers; callers get SELECT only (RLS scopes the rows).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dcmls_listings_public FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dcmls_participation_audit FROM anon, authenticated;
REVOKE SELECT ON public.dcmls_participation_audit FROM anon;
GRANT SELECT ON public.dcmls_listings_public TO anon, authenticated;
GRANT SELECT ON public.dcmls_participation_audit TO authenticated;