-- ============================================================================
-- Auth deletion queue: SQL fallback for the cron pump.
--
-- Finding from deployment: current_setting('supabase.service_role_key') is
-- EMPTY in this project, so process_auth_deletion_queue() could never
-- dispatch the delete-users edge function and pending retries would only
-- drain when an admin next used the delete flow.
--
-- Fix: keep the edge-function dispatch as the canonical path when the key is
-- available, but fall back to deleting auth.users directly in SQL when it is
-- not. This is safe and precedented (the Yanis cleanup migration deleted from
-- auth.users directly): all auth-schema child tables (identities, sessions,
-- refresh_tokens, mfa_factors, ...) cascade on delete, which also revokes any
-- live sessions. The fallback applies the same guarantees as the edge
-- function:
--   - resolves the canonical auth user (by id, then normalized email)
--   - refuses to delete users with surviving identity rows
--   - clears the non-cascading public-schema FK blockers first
--   - idempotent per-row bookkeeping (completed / abandoned / attempts+1)
-- ============================================================================

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
  r            record;
  v_auth_id    uuid;
BEGIN
  SELECT count(*) INTO v_pending
  FROM public.auth_user_deletion_queue
  WHERE status = 'pending';

  IF v_pending = 0 THEN
    RETURN;
  END IF;

  -- Canonical path: hand off to the delete-users edge function (GoTrue
  -- admin API) when a service-role key is available for the HTTP call.
  IF v_key IS NOT NULL AND v_key <> '' THEN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/delete-users',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object('processQueue', true)
    ) INTO request_id;
    RAISE LOG 'process_auth_deletion_queue: dispatched edge retry for % pending row(s), request_id %', v_pending, request_id;
    RETURN;
  END IF;

  -- SQL fallback: no service-role key GUC in this project. Process the queue
  -- directly with the same safety rules as the edge function.
  RAISE LOG 'process_auth_deletion_queue: service key GUC empty; using SQL fallback for % pending row(s)', v_pending;

  FOR r IN
    SELECT id, auth_user_id, email, attempts
    FROM public.auth_user_deletion_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 25
  LOOP
    BEGIN
      -- Resolve the canonical auth user (id first, then normalized email).
      v_auth_id := NULL;
      IF r.auth_user_id IS NOT NULL THEN
        SELECT id INTO v_auth_id FROM auth.users WHERE id = r.auth_user_id;
      END IF;
      IF v_auth_id IS NULL AND r.email IS NOT NULL THEN
        SELECT id INTO v_auth_id
        FROM auth.users
        WHERE lower(email) = lower(r.email)
        ORDER BY created_at ASC
        LIMIT 1;
      END IF;

      -- Already gone → nothing owed.
      IF v_auth_id IS NULL THEN
        UPDATE public.auth_user_deletion_queue
        SET status = 'completed', completed_at = now(), updated_at = now(),
            last_error = 'sql_fallback: auth user already absent'
        WHERE id = r.id;
        CONTINUE;
      END IF;

      -- Safety: never delete an auth user who still has application identity
      -- rows — the app-level deletion never actually happened.
      IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_auth_id)
         OR EXISTS (SELECT 1 FROM public.agent_profiles ap WHERE ap.id = v_auth_id)
         OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_auth_id) THEN
        UPDATE public.auth_user_deletion_queue
        SET status = 'abandoned', updated_at = now(),
            last_error = 'sql_fallback refused: user still has application identity rows (profiles/agent_profiles/user_roles)'
        WHERE id = r.id;
        CONTINUE;
      END IF;

      -- Clear non-cascading FK references that would block the delete.
      UPDATE public.share_tokens SET accepted_by_user_id = NULL WHERE accepted_by_user_id = v_auth_id;
      UPDATE public.listing_status_history SET changed_by = NULL WHERE changed_by = v_auth_id;
      UPDATE public.agent_invites SET accepted_user_id = NULL WHERE accepted_user_id = v_auth_id;
      UPDATE public.buyer_credentials SET verified_by = NULL WHERE verified_by = v_auth_id;

      -- Delete the auth user. auth-schema child rows (identities, sessions,
      -- refresh tokens, MFA factors) cascade, which also kills live sessions.
      DELETE FROM auth.users WHERE id = v_auth_id;

      UPDATE public.auth_user_deletion_queue
      SET status = 'completed', completed_at = now(), updated_at = now(),
          last_error = NULL
      WHERE id = r.id;

      RAISE LOG 'process_auth_deletion_queue: sql_fallback deleted auth user %', v_auth_id;
    EXCEPTION WHEN OTHERS THEN
      -- Row stays pending; record the exact reason and retry next tick.
      UPDATE public.auth_user_deletion_queue
      SET attempts = r.attempts + 1, updated_at = now(),
          last_error = 'sql_fallback: ' || SQLERRM
      WHERE id = r.id;
      RAISE WARNING 'process_auth_deletion_queue: sql_fallback failed for queue row % — %', r.id, SQLERRM;
    END;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'process_auth_deletion_queue failed: %', SQLERRM;
END;
$$;
