CREATE OR REPLACE FUNCTION public.list_hot_sheets_for_member(_hot_sheet_ids uuid[])
 RETURNS TABLE(id uuid, user_id uuid, client_id uuid, name text, criteria jsonb, is_active boolean, notify_client_email boolean, notify_agent_email boolean, notification_schedule text, last_sent_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text;
BEGIN
  IF _uid IS NULL OR _hot_sheet_ids IS NULL OR array_length(_hot_sheet_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT lower(p.email) INTO _email FROM public.profiles AS p WHERE p.id = _uid;

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
$function$;