-- Add an allowlisted p_template parameter to the activation issuance path so
-- admin-triggered resends can use the dedicated agent-activation-reminder
-- nudge email. The frozen license-verified template remains the default.

DROP FUNCTION public.build_activation_email_payload(uuid, text, text, text, text);

CREATE FUNCTION public.build_activation_email_payload(
  p_token_id uuid,
  p_to_email text,
  p_subject text,
  p_reply_to text,
  p_agent_name text,
  p_template text DEFAULT 'license-verified'
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  _subject text;
  _reply   text;
  _name    text;
  _template text;
BEGIN
  _template := lower(btrim(coalesce(p_template, 'license-verified')));
  IF _template NOT IN ('license-verified', 'agent-activation-reminder') THEN
    RAISE EXCEPTION 'unsupported activation email template' USING ERRCODE = '22023';
  END IF;

  _subject := left(btrim(coalesce(regexp_replace(p_subject, '[[:cntrl:]]', '', 'g'), '')), 200);
  IF _subject = '' THEN
    _subject := CASE _template
      WHEN 'agent-activation-reminder'
        THEN 'One last step — activate your All Agent Connect account'
      ELSE 'Your license has been verified — welcome to All Agent Connect'
    END;
  END IF;

  _reply := lower(btrim(coalesce(p_reply_to, '')));
  IF _reply !~ '^[a-z0-9._%+-]+@([a-z0-9-]+\.)*allagentconnect\.com$' THEN
    _reply := 'chris@allagentconnect.com';
  END IF;

  _name := left(btrim(coalesce(regexp_replace(p_agent_name, '[[:cntrl:]]', '', 'g'), '')), 80);

  RETURN jsonb_build_object(
    'provider', 'resend',
    'template', _template,
    'to', p_to_email,
    'subject', _subject,
    'reply_to', _reply,
    'agent_name', nullif(_name, ''),
    'activation_token_id', p_token_id::text,
    'idempotency_key', _template || '/' || p_token_id::text
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.build_activation_email_payload(uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.build_activation_email_payload(uuid, text, text, text, text, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.build_activation_email_payload(uuid, text, text, text, text, text) TO service_role;

DROP FUNCTION public.activation_issue_core(uuid, uuid, text, timestamp with time zone, text, boolean, text, text, text, boolean);

CREATE FUNCTION public.activation_issue_core(
  p_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone,
  p_issuance_key text,
  p_allow_replace boolean,
  p_subject text,
  p_reply_to text,
  p_agent_name text,
  p_allow_previously_deleted boolean DEFAULT false,
  p_template text DEFAULT 'license-verified'
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _existing  public.agent_activation_tokens%ROWTYPE;
  _email     text;
  _job_id    uuid;
  _payload   jsonb;
  _live_ct   int;
  _ack       boolean := coalesce(p_allow_previously_deleted, false);
  _template  text := lower(btrim(coalesce(p_template, 'license-verified')));
BEGIN
  IF p_id IS NULL OR p_user_id IS NULL
     OR coalesce(btrim(p_token_hash), '') = ''
     OR coalesce(btrim(p_issuance_key), '') = ''
     OR p_expires_at IS NULL THEN
    RAISE EXCEPTION 'invalid issuance arguments' USING ERRCODE = '22023';
  END IF;

  IF _template NOT IN ('license-verified', 'agent-activation-reminder') THEN
    RAISE EXCEPTION 'unsupported activation email template' USING ERRCODE = '22023';
  END IF;

  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'token_hash must be sha256 hex' USING ERRCODE = '22023';
  END IF;

  IF p_expires_at <= now() OR p_expires_at > now() + interval '31 days' THEN
    RAISE EXCEPTION 'expires_at out of range' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('aac_activation:' || p_user_id::text, 0));

  SELECT * INTO _existing
  FROM public.agent_activation_tokens
  WHERE issuance_key = p_issuance_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'deduped',
      'token_id', _existing.id,
      'job_id', _existing.email_job_id,
      'expires_at', _existing.expires_at
    );
  END IF;

  IF NOT (
    public.agent_is_activation_eligible(p_user_id, _ack)
    OR public.developer_is_activation_eligible(p_user_id, _ack)
  ) THEN
    RETURN jsonb_build_object('status', 'ineligible');
  END IF;

  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = p_user_id;
  IF _email IS NULL OR _email NOT LIKE '%@%' THEN
    RETURN jsonb_build_object('status', 'no_recipient');
  END IF;

  UPDATE public.agent_activation_tokens
     SET status = 'issued', redeeming_at = NULL
   WHERE user_id = p_user_id
     AND status = 'redeeming'
     AND redeeming_at < now() - interval '5 minutes';

  SELECT count(*) INTO _live_ct
  FROM public.agent_activation_tokens
  WHERE user_id = p_user_id AND status = 'redeeming';

  IF _live_ct > 0 THEN
    RETURN jsonb_build_object('status', 'blocked');
  END IF;

  IF p_allow_replace THEN
    UPDATE public.agent_activation_tokens
       SET status = 'revoked', revoked_at = now()
     WHERE user_id = p_user_id AND status = 'issued';
  ELSIF EXISTS (
    SELECT 1 FROM public.agent_activation_tokens
    WHERE user_id = p_user_id AND status = 'issued'
  ) THEN
    RETURN jsonb_build_object('status', 'already_live');
  END IF;

  INSERT INTO public.agent_activation_tokens
    (id, user_id, token_hash, issuance_key, status, expires_at, allow_previously_deleted)
  VALUES
    (p_id, p_user_id, lower(p_token_hash), p_issuance_key, 'issued', date_trunc('second', p_expires_at), _ack);

  _payload := public.build_activation_email_payload(p_id, _email, p_subject, p_reply_to, p_agent_name, _template);

  INSERT INTO public.email_jobs (payload, idempotency_key, max_attempts, stream)
  VALUES (_payload, _template || '/' || p_id::text, 6, 'transactional')
  RETURNING id INTO _job_id;

  UPDATE public.agent_activation_tokens SET email_job_id = _job_id WHERE id = p_id;

  RETURN jsonb_build_object(
    'status', 'created',
    'token_id', p_id,
    'job_id', _job_id,
    'expires_at', date_trunc('second', p_expires_at)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.activation_issue_core(uuid, uuid, text, timestamp with time zone, text, boolean, text, text, text, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activation_issue_core(uuid, uuid, text, timestamp with time zone, text, boolean, text, text, text, boolean, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.activation_issue_core(uuid, uuid, text, timestamp with time zone, text, boolean, text, text, text, boolean, text) TO service_role;

DROP FUNCTION public.reissue_agent_activation_token(uuid, uuid, text, timestamp with time zone, text, text, text, boolean);

CREATE FUNCTION public.reissue_agent_activation_token(
  p_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at timestamp with time zone,
  p_subject text DEFAULT NULL::text,
  p_reply_to text DEFAULT NULL::text,
  p_agent_name text DEFAULT NULL::text,
  p_allow_previously_deleted boolean DEFAULT false,
  p_template text DEFAULT 'license-verified'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_service_role();

  RETURN public.activation_issue_core(
    p_id,
    p_user_id,
    p_token_hash,
    p_expires_at,
    'admin-resend:' || p_user_id::text || ':' || to_char(now() AT TIME ZONE 'utc', 'YYYYMMDDHH24MI'),
    true,
    p_subject,
    p_reply_to,
    p_agent_name,
    coalesce(p_allow_previously_deleted, false),
    p_template
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reissue_agent_activation_token(uuid, uuid, text, timestamp with time zone, text, text, text, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reissue_agent_activation_token(uuid, uuid, text, timestamp with time zone, text, text, text, boolean, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reissue_agent_activation_token(uuid, uuid, text, timestamp with time zone, text, text, text, boolean, text) TO service_role;

-- Include the new template in the admin "Last Email" summary defaults.
CREATE OR REPLACE FUNCTION public.admin_agent_email_summary(_emails text[], _templates text[] DEFAULT ARRAY['admin-created-invite'::text, 'license-verified'::text], _latest_templates text[] DEFAULT ARRAY['license-verified'::text, 'admin-created-invite'::text, 'agent-invite'::text, 'agent-forward-invite'::text, 'personal-forward-invite'::text, 'founder-invite-1to1'::text, 'agent-temp-password'::text, 'agent-login-link'::text, 'agent-verification-submitted'::text, 'agent-approval-accepted'::text, 'agent-account-removed'::text, 'account-delegate-invite'::text, 'admin-adhoc'::text, 'team-approved'::text, 'team-request-notification'::text, 'concierge-listing-review'::text, 'password-reset'::text, 'agent-activation-reminder'::text])
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