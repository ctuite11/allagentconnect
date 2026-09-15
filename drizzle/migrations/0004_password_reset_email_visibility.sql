-- Function-body-only changes. No table, column, RLS or grant changes.

-- 1) Map the new audit-only template to the transactional stream so the
--    email_jobs stream trigger does not null it out.
CREATE OR REPLACE FUNCTION public.email_stream_for_template(p_template text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_template
    WHEN 'new-match-notification' THEN 'hot_sheet'
    WHEN 'hot-sheet-status-change' THEN 'hot_sheet'
    WHEN 'hot-sheet-subscriber-status-change' THEN 'hot_sheet'
    WHEN 'hot-sheet-subscriber-update' THEN 'hot_sheet'
    WHEN 'hot-sheet-alert' THEN 'hot_sheet'
    WHEN 'hot-sheet-preview-blast' THEN 'hot_sheet'
    WHEN 'hot-sheet-preview-blast-test' THEN 'hot_sheet'
    WHEN 'hot-sheet-invite' THEN 'hot_sheet'
    WHEN 'hot-sheet-comment' THEN 'hot_sheet'
    WHEN 'hot-sheet-agent-reply' THEN 'hot_sheet'
    WHEN 'price-change-notification' THEN 'hot_sheet'
    WHEN 'stale-listing-reminder' THEN 'hot_sheet'
    WHEN 'buyer-alert' THEN 'hot_sheet'
    WHEN 'seller-alert' THEN 'hot_sheet'
    WHEN 'reverse-prospecting' THEN 'hot_sheet'

    WHEN 'client-need-broadcast' THEN 'communications'
    WHEN 'client-need-notification' THEN 'communications'
    WHEN 'comms-digest' THEN 'communications'
    WHEN 'comms-center-guide' THEN 'communications'
    WHEN 'agent-activation-nudge' THEN 'communications'
    WHEN 'bulk-email' THEN 'communications'
    WHEN 'bulk-email-group' THEN 'communications'

    WHEN 'agent-profile-contact' THEN 'transactional'
    WHEN 'listing-contact-inquiry' THEN 'transactional'
    WHEN 'agent-client-email' THEN 'transactional'
    WHEN 'client-agent-message' THEN 'transactional'
    WHEN 'new-message-notification' THEN 'transactional'
    WHEN 'showing-request' THEN 'transactional'
    WHEN 'listing-share' THEN 'transactional'
    WHEN 'bulk-listing-share' THEN 'transactional'
    WHEN 'favorites-share' THEN 'transactional'
    WHEN 'buyer-workspace-invite' THEN 'transactional'
    WHEN 'account-delegate-invite' THEN 'transactional'
    WHEN 'team-invite' THEN 'transactional'
    WHEN 'team-request-notification' THEN 'transactional'
    WHEN 'team-decision' THEN 'transactional'
    WHEN 'agent-invite' THEN 'transactional'
    WHEN 'admin-created-invite' THEN 'transactional'
    WHEN 'admin-adhoc' THEN 'transactional'
    WHEN 'developer-account-approved' THEN 'transactional'
    WHEN 'agent-forward-invite' THEN 'transactional'
    WHEN 'personal-forward-invite' THEN 'transactional'
    WHEN 'founder-invite-1to1' THEN 'transactional'
    WHEN 'welcome-email' THEN 'transactional'
    WHEN 'license-verified' THEN 'transactional'
    WHEN 'agent-login-link' THEN 'transactional'
    WHEN 'agent-approval-accepted' THEN 'transactional'
    WHEN 'agent-account-removed' THEN 'transactional'
    WHEN 'agent-temp-password' THEN 'transactional'
    WHEN 'concierge-listing-review' THEN 'transactional'
    WHEN 'password-reset' THEN 'transactional'

    WHEN 'agent-verification-submitted' THEN 'system'
    WHEN 'developer-access-request-submitted' THEN 'system'

    WHEN 'development-lead-notification' THEN 'development_notifications'
    WHEN 'development-showing-request-notification' THEN 'development_notifications'

    ELSE NULL
  END;
$function$;

-- 2) Include password-reset in the Last Email (personal sends) allowlist.
CREATE OR REPLACE FUNCTION public.admin_agent_email_summary(
  _emails text[],
  _templates text[] DEFAULT ARRAY['admin-created-invite'::text, 'license-verified'::text],
  _latest_templates text[] DEFAULT ARRAY['license-verified'::text, 'admin-created-invite'::text, 'agent-invite'::text, 'agent-forward-invite'::text, 'personal-forward-invite'::text, 'founder-invite-1to1'::text, 'agent-temp-password'::text, 'agent-login-link'::text, 'agent-verification-submitted'::text, 'agent-approval-accepted'::text, 'agent-account-removed'::text, 'account-delegate-invite'::text, 'admin-adhoc'::text, 'team-approved'::text, 'team-request-notification'::text, 'concierge-listing-review'::text, 'password-reset'::text]
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