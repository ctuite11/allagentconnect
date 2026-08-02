BEGIN;

CREATE TABLE public.comms_reversal_targets_20260802 (
  user_id uuid PRIMARY KEY,
  email text,
  had_row boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.comms_reversal_targets_20260802 TO service_role;
ALTER TABLE public.comms_reversal_targets_20260802 ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.comms_reversal_rollback_20260802 (
  LIKE public.notification_preferences INCLUDING DEFAULTS
);
GRANT ALL ON public.comms_reversal_rollback_20260802 TO service_role;
ALTER TABLE public.comms_reversal_rollback_20260802 ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.comms_reversal_missing_rows_20260802 (
  user_id uuid PRIMARY KEY,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.comms_reversal_missing_rows_20260802 TO service_role;
ALTER TABLE public.comms_reversal_missing_rows_20260802 ENABLE ROW LEVEL SECURITY;

-- 1) Re-run the exact classification and materialize the 74 targets.
WITH elig AS (
  SELECT s.user_id, s.preferences_set, p.email
  FROM public.agent_settings s
  JOIN public.user_roles r ON r.user_id = s.user_id AND r.role = 'agent'
  JOIN public.agent_profiles p ON p.id = s.user_id
  WHERE s.agent_status = 'verified'
    AND (s.account_activated_at IS NOT NULL OR COALESCE(p.headshot_url,'') <> '')
    AND COALESCE(btrim(p.email),'') <> ''
    AND lower(p.email) NOT IN (SELECT lower(email) FROM public.email_unsubscribes)
),
j AS (
  SELECT e.*, n.user_id AS np_user, n.min_price, n.max_price, n.has_no_min, n.has_no_max,
         n.property_types, n.buyer_need, n.renter_need, n.sales_intel, n.general_discussion,
         n.client_needs_enabled, n.new_matches_enabled, n.client_needs_schedule, n.updated_at,
         (SELECT count(*) FROM public.agent_buyer_coverage_areas c
           WHERE c.agent_id = e.user_id AND c.source = 'notifications') AS cov_n
  FROM elig e
  LEFT JOIN public.notification_preferences n ON n.user_id = e.user_id
),
cls AS (
  SELECT j.*,
    CASE
      WHEN cov_n > 0 OR min_price IS NOT NULL OR max_price IS NOT NULL
        OR has_no_min IS TRUE OR has_no_max IS TRUE
        OR COALESCE(jsonb_array_length(property_types),0) > 0
        OR buyer_need IS FALSE OR renter_need IS FALSE OR sales_intel IS FALSE
        OR general_discussion IS FALSE OR client_needs_enabled IS FALSE
        OR new_matches_enabled IS FALSE
        OR (client_needs_schedule IS NOT NULL AND client_needs_schedule <> 'immediate')
        THEN 'A_configured'
      WHEN np_user IS NULL THEN 'C_never'
      WHEN preferences_set IS TRUE
        OR updated_at > timestamptz '2026-07-14 23:59:59+00' THEN 'B_ambiguous'
      ELSE 'C_never'
    END AS cls
  FROM j
)
INSERT INTO public.comms_reversal_targets_20260802 (user_id, email, had_row)
SELECT user_id, email, (np_user IS NOT NULL) FROM cls WHERE cls = 'C_never';

-- Guard: exact expected classification counts.
DO $$
DECLARE t int; BEGIN
  SELECT count(*) INTO t FROM public.comms_reversal_targets_20260802;
  IF t <> 74 THEN RAISE EXCEPTION 'Classification mismatch: never-configured = %, expected 74', t; END IF;
END $$;

-- 3) Rollback snapshot of existing rows for targets.
INSERT INTO public.comms_reversal_rollback_20260802
SELECT n.* FROM public.notification_preferences n
JOIN public.comms_reversal_targets_20260802 t ON t.user_id = n.user_id;

-- 4) Targets with no existing row.
INSERT INTO public.comms_reversal_missing_rows_20260802 (user_id, email)
SELECT user_id, email FROM public.comms_reversal_targets_20260802 WHERE had_row = false;

-- 5) Pre-flight safety checks.
DO $$
DECLARE d int; j int; BEGIN
  SELECT count(*) INTO d FROM public.comms_digest_items;
  IF d <> 0 THEN RAISE EXCEPTION 'comms_digest_items not empty: %', d; END IF;
  SELECT count(*) INTO j FROM public.email_jobs e
   WHERE e.status IN ('queued','processing','retryable')
     AND e.payload->>'template' = 'client-need-broadcast';
  IF j <> 0 THEN RAISE EXCEPTION 'pending client-need-broadcast jobs: %', j; END IF;
END $$;

-- 6) Apply the mute for the exact 74 targets only.
UPDATE public.notification_preferences n
SET buyer_need = false,
    renter_need = false,
    sales_intel = false,
    general_discussion = false,
    client_needs_enabled = false,
    new_matches_enabled = false,
    client_needs_schedule = 'immediate',
    updated_at = now()
FROM public.comms_reversal_targets_20260802 t
WHERE n.user_id = t.user_id;

INSERT INTO public.notification_preferences
  (user_id, buyer_need, renter_need, sales_intel, general_discussion,
   client_needs_enabled, new_matches_enabled, client_needs_schedule)
SELECT t.user_id, false, false, false, false, false, false, 'immediate'
FROM public.comms_reversal_targets_20260802 t
WHERE t.had_row = false;

-- 7) Post-conditions.
DO $$
DECLARE rows_present int; bad int; BEGIN
  SELECT count(*) INTO rows_present
    FROM public.notification_preferences n
    JOIN public.comms_reversal_targets_20260802 t ON t.user_id = n.user_id;
  IF rows_present <> 74 THEN RAISE EXCEPTION 'target rows present = %, expected 74', rows_present; END IF;

  SELECT count(*) INTO bad
    FROM public.notification_preferences n
    JOIN public.comms_reversal_targets_20260802 t ON t.user_id = n.user_id
   WHERE n.buyer_need OR n.renter_need OR n.sales_intel OR n.general_discussion
      OR n.client_needs_enabled OR n.new_matches_enabled
      OR n.client_needs_schedule <> 'immediate';
  IF bad <> 0 THEN RAISE EXCEPTION 'targets still enabled: %', bad; END IF;
END $$;

COMMIT;