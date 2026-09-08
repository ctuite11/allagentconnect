-- Index supporting per-recipient newest-first lookups (case-insensitive recipient).
CREATE INDEX IF NOT EXISTS idx_email_jobs_lower_to_created_at
  ON public.email_jobs ((lower(payload->>'to')), created_at DESC);

-- Index supporting per-recipient + per-template newest-first lookups.
CREATE INDEX IF NOT EXISTS idx_email_jobs_lower_to_template_created_at
  ON public.email_jobs ((lower(payload->>'to')), (payload->>'template'), created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_agent_email_summary(
  _emails text[],
  _templates text[] DEFAULT ARRAY['admin-created-invite','license-verified']
)
RETURNS TABLE (
  email text,
  kind text,
  template text,
  created_at timestamptz,
  status text,
  delivery_status text,
  delivery_status_at timestamptz,
  attempts integer,
  last_error text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recipients AS (
    SELECT DISTINCT lower(e) AS email
    FROM unnest(coalesce(_emails, ARRAY[]::text[])) AS e
    WHERE e IS NOT NULL AND length(trim(e)) > 0
  )
  -- Newest email of any template, per recipient
  SELECT r.email,
         'latest'::text AS kind,
         j.payload->>'template' AS template,
         j.created_at,
         j.status,
         j.delivery_status,
         j.delivery_status_at,
         j.attempts,
         j.last_error
  FROM recipients r
  CROSS JOIN LATERAL (
    SELECT ej.*
    FROM public.email_jobs ej
    WHERE lower(ej.payload->>'to') = r.email
    ORDER BY ej.created_at DESC
    LIMIT 1
  ) j

  UNION ALL

  -- Newest email per required lifecycle template, per recipient
  SELECT r.email,
         'template'::text AS kind,
         t.template,
         j.created_at,
         j.status,
         j.delivery_status,
         j.delivery_status_at,
         j.attempts,
         j.last_error
  FROM recipients r
  CROSS JOIN unnest(coalesce(_templates, ARRAY[]::text[])) AS t(template)
  CROSS JOIN LATERAL (
    SELECT ej.*
    FROM public.email_jobs ej
    WHERE lower(ej.payload->>'to') = r.email
      AND ej.payload->>'template' = t.template
    ORDER BY ej.created_at DESC
    LIMIT 1
  ) j;
$$;

REVOKE ALL ON FUNCTION public.admin_agent_email_summary(text[], text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_agent_email_summary(text[], text[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_agent_email_summary(text[], text[]) TO service_role;