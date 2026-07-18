-- ============================================================================
-- Atomic admin user deletion: durable auth-deletion outbox + canonical
-- auth-id handoff + one-time orphan backfill.
--
-- Problem this fixes (Yanis Benyamina, Billy Frack):
--   admin_delete_agent removed application rows, then the delete-users edge
--   function failed (stale token / FK blocker / transient error) and the
--   auth.users row survived forever as a ghost login with no profile/role.
--
-- Design:
--   1. auth_user_deletion_queue — outbox table. admin_delete_agent inserts a
--      pending row IN THE SAME TRANSACTION that removes application rows, so
--      an auth deletion can never be "forgotten" once app rows are gone.
--   2. admin_delete_agent now resolves the CANONICAL auth user id (by id,
--      falling back to normalized email) and returns it as jsonb, so callers
--      never have to assume agent_profiles.id == auth.users.id.
--   3. delete-users edge function (deployed separately) drains the queue,
--      marks rows completed, and re-queues failures.
--   4. pg_cron pump retries pending rows every 10 minutes via pg_net, so a
--      transient failure self-heals without admin action.
--   5. One-time backfill enqueues existing orphans: auth.users rows matching
--      deleted_users (by original_user_id or normalized email) that have no
--      remaining application identity rows. They are purged through the
--      canonical service-role path (edge function), not raw SQL.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Outbox table
-- ----------------------------------------------------------------------------
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

-- One live pending row per target (idempotency backstop).
CREATE UNIQUE INDEX IF NOT EXISTS auth_user_deletion_queue_pending_user_uidx
  ON public.auth_user_deletion_queue (auth_user_id)
  WHERE status = 'pending' AND auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS auth_user_deletion_queue_pending_email_uidx
  ON public.auth_user_deletion_queue (lower(email))
  WHERE status = 'pending' AND auth_user_id IS NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS auth_user_deletion_queue_status_idx
  ON public.auth_user_deletion_queue (status, created_at);

ALTER TABLE public.auth_user_deletion_queue ENABLE ROW LEVEL SECURITY;

-- Admins may inspect the queue; all writes go through SECURITY DEFINER
-- functions or the service-role edge function (which bypasses RLS).
DROP POLICY IF EXISTS "Admins can view auth deletion queue"
  ON public.auth_user_deletion_queue;
CREATE POLICY "Admins can view auth deletion queue"
  ON public.auth_user_deletion_queue
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.auth_user_deletion_queue IS
  'Durable outbox for auth.users deletions. A pending row is created in the same transaction that removes application rows, and is completed by the delete-users edge function. Prevents ghost auth accounts.';

-- ----------------------------------------------------------------------------
-- 2. Canonical auth-user resolver (service-role only; used by delete-users)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. admin_delete_agent: resolve canonical auth id, enqueue auth deletion in
--    the SAME transaction, then remove application rows. Returns jsonb with
--    the canonical auth id so callers never assume agent_profiles.id is it.
--    (Return type changes void -> jsonb, so drop first.)
-- ----------------------------------------------------------------------------
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
  -- Enforce admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Resolve canonical auth identity BEFORE any rows disappear.
  SELECT lower(email) INTO v_email FROM public.agent_profiles WHERE id = p_agent_id;

  SELECT id INTO v_auth_id FROM auth.users WHERE id = p_agent_id;
  IF v_auth_id IS NULL AND v_email IS NOT NULL THEN
    -- Legacy accounts where agent_profiles.id != auth.users.id
    SELECT id INTO v_auth_id
    FROM auth.users
    WHERE lower(email) = v_email
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  IF v_email IS NULL AND v_auth_id IS NOT NULL THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_auth_id;
  END IF;

  -- Durable outbox row in the SAME transaction as the app-row cleanup.
  -- Even if the delete-users edge call never happens, the cron pump will
  -- finish the auth deletion.
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
      NULL; -- concurrent enqueue; pending row already exists
    END;
  END IF;

  -- SET NULL on blocker FK columns (non-cascading FKs to auth.users)
  UPDATE public.agent_invites SET accepted_user_id = NULL WHERE accepted_user_id = p_agent_id;
  UPDATE public.listing_status_history SET changed_by = NULL WHERE changed_by = p_agent_id;
  UPDATE public.buyer_credentials SET verified_by = NULL WHERE verified_by = p_agent_id;
  UPDATE public.share_tokens SET accepted_by_user_id = NULL WHERE accepted_by_user_id = p_agent_id;

  -- Explicit deletes for tables with no CASCADE or no FK at all
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

  -- Hot sheet cascade: remove child rows then hot sheets
  DELETE FROM public.hot_sheet_clients WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_favorites WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_sent_listings WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_notifications WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_listing_status WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheet_comments WHERE hot_sheet_id IN (SELECT id FROM public.hot_sheets WHERE user_id = p_agent_id);
  DELETE FROM public.hot_sheets WHERE user_id = p_agent_id;

  -- Listing cascade: remove child rows then listings
  DELETE FROM public.favorite_price_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.favorites WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_status_history WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_views WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listing_stats WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.showing_requests WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.agent_messages WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.conversations WHERE listing_id IN (SELECT id FROM public.listings WHERE agent_id = p_agent_id);
  DELETE FROM public.listings WHERE agent_id = p_agent_id;

  -- Remaining agent-specific tables
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

  -- Profile tables last
  DELETE FROM public.profiles WHERE id = p_agent_id;
  DELETE FROM public.agent_profiles WHERE id = p_agent_id;

  -- Also clean rows keyed to the canonical auth id when it differs from
  -- agent_profiles.id (legacy mismatch): identity tables only, so the
  -- auth deletion cannot be blocked and no ghost role/profile survives.
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

-- ----------------------------------------------------------------------------
-- 4. Cron pump: retries pending auth deletions via the delete-users edge
--    function (service-role internal call). Self-heals transient failures.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 5. One-time backfill: enqueue existing orphaned auth users (Billy Frack et
--    al). Guards:
--      - must match a deleted_users record by original id OR normalized email
--      - must have NO surviving application identity rows
--      - must not be an account re-registered after the deletion
--    Purge happens through the canonical service-role path (edge function),
--    driven by the cron pump above.
-- ----------------------------------------------------------------------------
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
