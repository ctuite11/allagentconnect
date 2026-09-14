CREATE OR REPLACE FUNCTION public.admin_agent_email_summary(
  _emails text[],
  _templates text[] DEFAULT ARRAY['admin-created-invite'::text, 'license-verified'::text],
  _latest_templates text[] DEFAULT ARRAY[
    'license-verified'::text,
    'admin-created-invite'::text,
    'agent-invite'::text,
    'agent-forward-invite'::text,
    'personal-forward-invite'::text,
    'founder-invite-1to1'::text,
    'agent-temp-password'::text,
    'agent-login-link'::text,
    'agent-verification-submitted'::text,
    'agent-approval-accepted'::text,
    'agent-account-removed'::text,
    'account-delegate-invite'::text,
    'admin-adhoc'::text,
    'team-approved'::text,
    'team-request-notification'::text
  ]
)
RETURNS TABLE(
  email text,
  kind text,
  template text,
  created_at timestamp with time zone,
  status text,
  delivery_status text,
  delivery_status_at timestamp with time zone,
  attempts integer,
  last_error text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH recipients AS (
    SELECT DISTINCT lower(e) AS email
    FROM unnest(coalesce(_emails, ARRAY[]::text[])) AS e
    WHERE e IS NOT NULL AND length(trim(e)) > 0
  ),
  per_template AS (
    SELECT DISTINCT ON (lower(ej.payload->>'to'), ej.payload->>'template')
           lower(ej.payload->>'to') AS email,
           ej.payload->>'template'  AS template,
           ej.created_at,
           ej.status,
           ej.delivery_status,
           ej.delivery_status_at,
           ej.attempts,
           ej.last_error
    FROM recipients r
    JOIN public.email_jobs ej
      ON lower(ej.payload->>'to') = r.email
    WHERE ej.payload->>'template' = ANY(
            coalesce(_templates, ARRAY[]::text[]) || coalesce(_latest_templates, ARRAY[]::text[])
          )
    ORDER BY lower(ej.payload->>'to'), ej.payload->>'template', ej.created_at DESC
  ),
  latest_row AS (
    SELECT DISTINCT ON (p.email)
           p.email, p.template, p.created_at, p.status,
           p.delivery_status, p.delivery_status_at, p.attempts, p.last_error
    FROM per_template p
    WHERE _latest_templates IS NULL OR p.template = ANY(_latest_templates)
    ORDER BY p.email, p.created_at DESC
  )
  SELECT l.email, 'latest'::text, l.template, l.created_at, l.status,
         l.delivery_status, l.delivery_status_at, l.attempts, l.last_error
  FROM latest_row l
  UNION ALL
  SELECT p.email, 'template'::text, p.template, p.created_at, p.status,
         p.delivery_status, p.delivery_status_at, p.attempts, p.last_error
  FROM per_template p
  WHERE p.template = ANY(coalesce(_templates, ARRAY[]::text[]));
$function$;