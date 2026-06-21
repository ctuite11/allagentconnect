
-- ============================================================
-- #4 hot_sheets — Step 1: Add secure RPCs
-- (Broad "Anyone can view hot sheets with valid token" policy left in place as safety net)
-- ============================================================

-- 1. get_hot_sheet_by_token: anonymous-safe, validates share_tokens
CREATE OR REPLACE FUNCTION public.get_hot_sheet_by_token(_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(hs)
  FROM public.share_tokens st
  JOIN public.hot_sheets hs
    ON hs.id = NULLIF(
         COALESCE(
           st.payload ->> 'hot_sheet_id',
           st.payload ->> 'hotSheetId',
           st.payload ->> 'hotsheetId'
         ),
         ''
       )::uuid
  WHERE st.token = _token
    AND st.revoked_at IS NULL
    AND (st.expires_at IS NULL OR st.expires_at > now())
  LIMIT 1;
$$;

-- Drop access_token from the JSON shape
CREATE OR REPLACE FUNCTION public.get_hot_sheet_by_token(_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', hs.id,
    'user_id', hs.user_id,
    'client_id', hs.client_id,
    'name', hs.name,
    'criteria', hs.criteria,
    'is_active', hs.is_active,
    'notify_client_email', hs.notify_client_email,
    'notify_agent_email', hs.notify_agent_email,
    'notification_schedule', hs.notification_schedule,
    'last_sent_at', hs.last_sent_at,
    'created_at', hs.created_at,
    'updated_at', hs.updated_at
  )
  FROM public.share_tokens st
  JOIN public.hot_sheets hs
    ON hs.id = NULLIF(
         COALESCE(
           st.payload ->> 'hot_sheet_id',
           st.payload ->> 'hotSheetId',
           st.payload ->> 'hotsheetId'
         ),
         ''
       )::uuid
  WHERE st.token = _token
    AND st.revoked_at IS NULL
    AND (st.expires_at IS NULL OR st.expires_at > now())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_hot_sheet_by_token(text) TO anon, authenticated, service_role;

-- 2. get_hot_sheet_for_member: authenticated, owner | admin | linked client
CREATE OR REPLACE FUNCTION public.get_hot_sheet_for_member(_hot_sheet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _result jsonb;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT lower(email) INTO _email FROM public.profiles WHERE id = _uid;

  SELECT jsonb_build_object(
    'id', hs.id,
    'user_id', hs.user_id,
    'client_id', hs.client_id,
    'name', hs.name,
    'criteria', hs.criteria,
    'is_active', hs.is_active,
    'notify_client_email', hs.notify_client_email,
    'notify_agent_email', hs.notify_agent_email,
    'notification_schedule', hs.notification_schedule,
    'last_sent_at', hs.last_sent_at,
    'created_at', hs.created_at,
    'updated_at', hs.updated_at
  )
  INTO _result
  FROM public.hot_sheets hs
  WHERE hs.id = _hot_sheet_id
    AND (
      hs.user_id = _uid
      OR public.has_role(_uid, 'admin'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.hot_sheet_clients hsc
        JOIN public.clients c ON c.id = hsc.client_id
        WHERE hsc.hot_sheet_id = hs.id
          AND (c.agent_user_id = _uid OR (_email IS NOT NULL AND lower(c.email) = _email))
      )
      OR EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = hs.client_id
          AND (c.agent_user_id = _uid OR (_email IS NOT NULL AND lower(c.email) = _email))
      )
      OR EXISTS (
        SELECT 1
        FROM public.share_tokens st
        WHERE NULLIF(
                COALESCE(
                  st.payload ->> 'hot_sheet_id',
                  st.payload ->> 'hotSheetId',
                  st.payload ->> 'hotsheetId'
                ),
                ''
              )::uuid = hs.id
          AND st.revoked_at IS NULL
          AND (
            st.accepted_by_user_id = _uid
            OR (_email IS NOT NULL AND lower(st.payload ->> 'client_email') = _email)
          )
      )
    );

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hot_sheet_for_member(uuid) TO authenticated, service_role;

-- 3. list_hot_sheets_for_member: batch version
CREATE OR REPLACE FUNCTION public.list_hot_sheets_for_member(_hot_sheet_ids uuid[])
RETURNS TABLE (
  id uuid,
  user_id uuid,
  client_id uuid,
  name text,
  criteria jsonb,
  is_active boolean,
  notify_client_email boolean,
  notify_agent_email boolean,
  notification_schedule text,
  last_sent_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
BEGIN
  IF _uid IS NULL OR _hot_sheet_ids IS NULL OR array_length(_hot_sheet_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT lower(email) INTO _email FROM public.profiles WHERE id = _uid;

  RETURN QUERY
  SELECT
    hs.id,
    hs.user_id,
    hs.client_id,
    hs.name,
    hs.criteria,
    hs.is_active,
    hs.notify_client_email,
    hs.notify_agent_email,
    hs.notification_schedule,
    hs.last_sent_at,
    hs.created_at,
    hs.updated_at
  FROM public.hot_sheets hs
  WHERE hs.id = ANY(_hot_sheet_ids)
    AND (
      hs.user_id = _uid
      OR public.has_role(_uid, 'admin'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.hot_sheet_clients hsc
        JOIN public.clients c ON c.id = hsc.client_id
        WHERE hsc.hot_sheet_id = hs.id
          AND (c.agent_user_id = _uid OR (_email IS NOT NULL AND lower(c.email) = _email))
      )
      OR EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = hs.client_id
          AND (c.agent_user_id = _uid OR (_email IS NOT NULL AND lower(c.email) = _email))
      )
      OR EXISTS (
        SELECT 1
        FROM public.share_tokens st
        WHERE NULLIF(
                COALESCE(
                  st.payload ->> 'hot_sheet_id',
                  st.payload ->> 'hotSheetId',
                  st.payload ->> 'hotsheetId'
                ),
                ''
              )::uuid = hs.id
          AND st.revoked_at IS NULL
          AND (
            st.accepted_by_user_id = _uid
            OR (_email IS NOT NULL AND lower(st.payload ->> 'client_email') = _email)
          )
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_hot_sheets_for_member(uuid[]) TO authenticated, service_role;
