CREATE TABLE IF NOT EXISTS public.auth_user_deletion_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid,
  email         text,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed', 'abandoned')),
  attempts      integer NOT NULL DEFAULT 0,
  last_error    text,
  requested_by  uuid,
  source        text NOT NULL DEFAULT 'admin_delete_agent',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  CONSTRAINT auth_user_deletion_queue_target_chk
    CHECK (auth_user_id IS NOT NULL OR email IS NOT NULL)
);

GRANT SELECT ON public.auth_user_deletion_queue TO authenticated;
GRANT ALL ON public.auth_user_deletion_queue TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS auth_user_deletion_queue_pending_user_uidx
  ON public.auth_user_deletion_queue (auth_user_id)
  WHERE status = 'pending' AND auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS auth_user_deletion_queue_pending_email_uidx
  ON public.auth_user_deletion_queue (lower(email))
  WHERE status = 'pending' AND auth_user_id IS NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS auth_user_deletion_queue_status_idx
  ON public.auth_user_deletion_queue (status, created_at);

ALTER TABLE public.auth_user_deletion_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view auth deletion queue"
  ON public.auth_user_deletion_queue;
CREATE POLICY "Admins can view auth deletion queue"
  ON public.auth_user_deletion_queue
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.auth_user_deletion_queue IS
  'Durable outbox for auth.users deletions. A pending row is created in the same transaction that removes application rows, and is completed by the delete-users edge function. Prevents ghost auth accounts.';

CREATE OR REPLACE FUNCTION public.resolve_auth_user_for_deletion(
  p_user_id uuid DEFAULT NULL,
  p_email   text DEFAULT NULL
)
RETURNS TABLE (auth_user_id uuid, auth_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.id, lower(u.email)
  FROM auth.users u
  WHERE (p_user_id IS NOT NULL AND u.id = p_user_id)
     OR (p_email IS NOT NULL AND lower(u.email) = lower(p_email))
  ORDER BY (u.id = p_user_id) DESC NULLS LAST, u.created_at ASC
$$;

REVOKE ALL ON FUNCTION public.resolve_auth_user_for_deletion(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_auth_user_for_deletion(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_auth_user_for_deletion(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_auth_user_for_deletion(uuid, text) TO service_role;

DROP FUNCTION IF EXISTS public.admin_delete_agent(uuid);

CREATE FUNCTION public.admin_delete_agent(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email   text;
  v_auth_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT lower(email) INTO v_email FROM public.agent_profiles WHERE id = p_agent_id;

  SELECT id INTO v_auth_id FROM auth.users WHERE id = p_agent_id;
  IF v_auth_id IS NULL AND v_email IS NOT NULL THEN
    SELECT id INTO v_auth_id
    FROM auth.users
    WHERE lower(email) = v_email
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  IF v_email IS NULL AND v_auth_id IS NOT NULL THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_auth_id;
  END IF;

  IF v_auth_id IS NOT NULL OR v_email IS NOT NULL THEN
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM public.auth_user_deletion_queue q
        WHERE q.status = 'pending'
          AND (
            (v_auth_id IS NOT NULL AND q.auth_user_id = v_auth_id)
            OR (v_auth_id IS NULL AND lower(q.email) = v_email)
          )
      ) THEN
        INSERT INTO public.auth_user_deletion_queue
          (auth_user_id, email, requested_by, source)
        VALUES (v_auth_id, v_email, auth.uid(), 'admin_delete_agent');
      END IF;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;

  UPDATE public.agent_invites SET accepted_user_id = NULL WHERE accepted_user_id = p_agent_id;
  UPDATE public.listing_status_history SET changed_by = NULL WHERE changed_by = p_agent_id;
  UPDATE public.buyer_credentials SET verified_by = NULL WHERE verified_by = p_agent_id;
  UPDATE public.share_tokens SET accepted_by_user_id = NULL WHERE accepted_by_user_id = p_agent_id;

  DELETE FROM public.hot_sheet_comments WHERE sender_id = p_agent_id;
  DELETE FROM public.seller_matches WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_match_deliveries WHERE agent_id = p_agent_id;
  DELETE FROM public.conversation_participants WHERE user_id = p_agent_id;
  DELETE FROM public.conversation_messages WHERE sender_agent_id = p_agent_id OR recipient_agent_id = p_agent_id;
  DELETE FROM public.share_tokens WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_notifications WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_messages WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_proposal_incentives WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_license_uploads WHERE user_id = p_agent_id;
  DELETE FROM public.email_campaigns WHERE agent_id = p_agent_id;
  DELETE FROM public.client_agent_relationships WHERE agent_id = p_agent_id;

  DELETE FROM public.hot_sheet_clients WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_favorites WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_sent_listings WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_notifications WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_listing_status WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_comments WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheets WHERE user_id = p_agent_id;

  DELETE FROM public.favorite_price_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.favorites WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_status_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_views WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_stats WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.showing_requests WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.agent_messages WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.conversations WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listings WHERE agent_id = p_agent_id;

  DELETE FROM public.listing_drafts WHERE user_id = p_agent_id;
  DELETE FROM public.clients WHERE agent_id = p_agent_id;
  DELETE FROM public.email_templates WHERE agent_id = p_agent_id;
  DELETE FROM public.testimonials WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_buyer_coverage_areas WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_county_preferences WHERE agent_id = p_agent_id;
  DELETE FROM public.agent_state_preferences WHERE agent_id = p_agent_id;
  DELETE FROM public.notification_preferences WHERE user_id = p_agent_id;
  DELETE FROM public.agent_settings WHERE user_id = p_agent_id;
  DELETE FROM public.user_roles WHERE user_id = p_agent_id;
  DELETE FROM public.favorites WHERE user_id = p_agent_id;
  DELETE FROM public.client_needs WHERE submitted_by = p_agent_id;

  DELETE FROM public.profiles WHERE id = p_agent_id;
  DELETE FROM public.agent_profiles WHERE id = p_agent_id;

  IF v_auth_id IS NOT NULL AND v_auth_id <> p_agent_id THEN
    UPDATE public.agent_invites SET accepted_user_id = NULL WHERE accepted_user_id = v_auth_id;
    UPDATE public.listing_status_history SET changed_by = NULL WHERE changed_by = v_auth_id;
    UPDATE public.buyer_credentials SET verified_by = NULL WHERE verified_by = v_auth_id;
    UPDATE public.share_tokens SET accepted_by_user_id = NULL WHERE accepted_by_user_id = v_auth_id;
    DELETE FROM public.user_roles WHERE user_id = v_auth_id;
    DELETE FROM public.agent_settings WHERE user_id = v_auth_id;
    DELETE FROM public.notification_preferences WHERE user_id = v_auth_id;
    DELETE FROM public.profiles WHERE id = v_auth_id;
    DELETE FROM public.agent_profiles WHERE id = v_auth_id;
  END IF;

  RETURN jsonb_build_object(
    'auth_user_id', v_auth_id,
    'email', v_email,
    'auth_deletion_queued', (v_auth_id IS NOT NULL OR v_email IS NOT NULL)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_auth_deletion_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pending    integer;
  v_key        text := current_setting('supabase.service_role_key', true);
  request_id   bigint;
  supabase_url text := 'https://qocduqtfbsevnhlgsfka.supabase.co';
BEGIN
  SELECT count(*) INTO v_pending
  FROM public.auth_user_deletion_queue
  WHERE status = 'pending';

  IF v_pending = 0 THEN
    RETURN;
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    RAISE WARNING 'process_auth_deletion_queue: service role key unavailable; % pending row(s) not processed', v_pending;
    RETURN;
  END IF;

  SELECT net.http_post(
    url := supabase_url || '/functions/v1/delete-users',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('processQueue', true)
  ) INTO request_id;

  RAISE LOG 'process_auth_deletion_queue: dispatched retry for % pending row(s), request_id %', v_pending, request_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'process_auth_deletion_queue failed: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-auth-deletion-queue') THEN
    PERFORM cron.unschedule('process-auth-deletion-queue');
  END IF;
  PERFORM cron.schedule(
    'process-auth-deletion-queue',
    '*/10 * * * *',
    $cron$ SELECT public.process_auth_deletion_queue(); $cron$
  );
END $$;

INSERT INTO public.auth_user_deletion_queue (auth_user_id, email, source)
SELECT DISTINCT u.id, lower(u.email), 'orphan_backfill'
FROM auth.users u
JOIN public.deleted_users d
  ON d.original_user_id = u.id
  OR (u.email IS NOT NULL AND lower(d.email) = lower(u.email))
WHERE u.created_at <= d.deleted_at
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  AND NOT EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE ap.id = u.id)
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.auth_user_deletion_queue q
    WHERE q.status = 'pending' AND q.auth_user_id = u.id
  );