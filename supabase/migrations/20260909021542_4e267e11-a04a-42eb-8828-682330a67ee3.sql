CREATE OR REPLACE FUNCTION public.admin_agent_email_summary(
  _emails text[],
  _templates text[] DEFAULT ARRAY['admin-created-invite'::text, 'license-verified'::text],
  _latest_templates text[] DEFAULT ARRAY[
    'license-verified','admin-created-invite','agent-invite','agent-forward-invite',
    'personal-forward-invite','founder-invite-1to1','agent-activation-nudge',
    'agent-missing-opportunities','agent-temp-password','agent-login-link',
    'agent-verification-submitted','agent-approval-accepted','agent-account-removed',
    'account-delegate-invite','admin-adhoc','bulk-email','comms-center-guide',
    'team-approved','team-request-notification'
  ]
)
RETURNS TABLE(email text, kind text, template text, created_at timestamp with time zone, status text, delivery_status text, delivery_status_at timestamp with time zone, attempts integer, last_error text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH recipients AS (
    SELECT DISTINCT lower(e) AS email
    FROM unnest(coalesce(_emails, ARRAY[]::text[])) AS e
    WHERE e IS NOT NULL AND length(trim(e)) > 0
  )
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
      AND (
        _latest_templates IS NULL
        OR ej.payload->>'template' = ANY(_latest_templates)
      )
    ORDER BY ej.created_at DESC
    LIMIT 1
  ) j

  UNION ALL

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
$function$;

REVOKE ALL ON FUNCTION public.admin_agent_email_summary(text[], text[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_agent_email_summary(text[], text[], text[]) TO service_role;