-- ============================================================================
-- Step 3A: stamp account_activated_at for two proven activation-token redemptions.
--
-- Patricia Burns  b01352e3-1cef-4289-8927-e2cecb666803
--   redeemed_at → 2026-08-01 21:01:34.187814+00
-- Maria Renda     7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca
--   redeemed_at → 2026-08-03 09:46:57.472291+00
--
-- Guards:
--   * one transaction
--   * only verified + account_activated_at IS NULL
--   * matching redeemed agent_activation_tokens.redeemed_at required
--   * abort with zero writes if either target fails preconditions
--   * uses redeemed activation-token time only (not auth sign-in time)
--   * does NOT touch anyone else
--   * no emails / queues / RPC redefinitions
-- ============================================================================

BEGIN;

CREATE TEMP TABLE step3a_targets (
  user_id uuid PRIMARY KEY,
  expected_redeemed_at timestamptz NOT NULL
);

INSERT INTO step3a_targets (user_id, expected_redeemed_at) VALUES
  (
    'b01352e3-1cef-4289-8927-e2cecb666803',
    timestamptz '2026-08-01 21:01:34.187814+00'
  ),
  (
    '7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca',
    timestamptz '2026-08-03 09:46:57.472291+00'
  );

-- Snapshot existing activation stamps so we can prove no collateral changes.
CREATE TEMP TABLE step3a_activated_before AS
SELECT user_id, account_activated_at
FROM public.agent_settings
WHERE account_activated_at IS NOT NULL;

-- Preconditions: both targets must be eligible before any write.
DO $$
DECLARE
  ready int;
BEGIN
  SELECT count(*) INTO ready
  FROM step3a_targets t
  JOIN public.agent_settings s
    ON s.user_id = t.user_id
  WHERE s.agent_status = 'verified'::public.agent_status
    AND s.account_activated_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.agent_activation_tokens tok
      WHERE tok.user_id = t.user_id
        AND tok.status = 'redeemed'
        AND tok.redeemed_at IS NOT DISTINCT FROM t.expected_redeemed_at
    );

  IF ready <> 2 THEN
    RAISE EXCEPTION
      'Step 3A aborted: expected 2 precondition-ready targets, found %. No rows updated.',
      ready;
  END IF;
END $$;

UPDATE public.agent_settings s
SET
  account_activated_at = t.expected_redeemed_at,
  updated_at = now()
FROM step3a_targets t
WHERE s.user_id = t.user_id
  AND s.agent_status = 'verified'::public.agent_status
  AND s.account_activated_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.agent_activation_tokens tok
    WHERE tok.user_id = t.user_id
      AND tok.status = 'redeemed'
      AND tok.redeemed_at IS NOT DISTINCT FROM t.expected_redeemed_at
  );

-- Post-conditions: exactly two rows changed; stamps match redeemed_at; Network RPC includes both;
-- no other account_activated_at values changed.
DO $$
DECLARE
  updated_n int;
  patricia_at timestamptz;
  maria_at timestamptz;
  patricia_tok timestamptz;
  maria_tok timestamptz;
  in_network int;
  collateral int;
BEGIN
  SELECT count(*) INTO updated_n
  FROM public.agent_settings s
  JOIN step3a_targets t ON t.user_id = s.user_id
  WHERE s.account_activated_at IS NOT DISTINCT FROM t.expected_redeemed_at;

  IF updated_n <> 2 THEN
    RAISE EXCEPTION
      'Step 3A aborted: expected exactly 2 updated activation stamps, found %',
      updated_n;
  END IF;

  SELECT s.account_activated_at INTO patricia_at
  FROM public.agent_settings s
  WHERE s.user_id = 'b01352e3-1cef-4289-8927-e2cecb666803';

  SELECT tok.redeemed_at INTO patricia_tok
  FROM public.agent_activation_tokens tok
  WHERE tok.user_id = 'b01352e3-1cef-4289-8927-e2cecb666803'
    AND tok.status = 'redeemed'
    AND tok.redeemed_at IS NOT DISTINCT FROM timestamptz '2026-08-01 21:01:34.187814+00'
  LIMIT 1;

  IF patricia_at IS DISTINCT FROM patricia_tok THEN
    RAISE EXCEPTION
      'Step 3A aborted: Patricia account_activated_at (%) does not equal token redeemed_at (%)',
      patricia_at, patricia_tok;
  END IF;

  SELECT s.account_activated_at INTO maria_at
  FROM public.agent_settings s
  WHERE s.user_id = '7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca';

  SELECT tok.redeemed_at INTO maria_tok
  FROM public.agent_activation_tokens tok
  WHERE tok.user_id = '7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca'
    AND tok.status = 'redeemed'
    AND tok.redeemed_at IS NOT DISTINCT FROM timestamptz '2026-08-03 09:46:57.472291+00'
  LIMIT 1;

  IF maria_at IS DISTINCT FROM maria_tok THEN
    RAISE EXCEPTION
      'Step 3A aborted: Maria account_activated_at (%) does not equal token redeemed_at (%)',
      maria_at, maria_tok;
  END IF;

  SELECT count(*) INTO in_network
  FROM public.get_verified_agent_ids() g
  WHERE g.user_id IN (
    'b01352e3-1cef-4289-8927-e2cecb666803',
    '7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca'
  );

  IF in_network <> 2 THEN
    RAISE EXCEPTION
      'Step 3A aborted: expected both agents in get_verified_agent_ids(), found %',
      in_network;
  END IF;

  -- Any newly non-null activation stamp outside the two targets, or any
  -- previously-activated stamp that drifted, is collateral damage.
  SELECT count(*) INTO collateral
  FROM public.agent_settings s
  WHERE s.user_id NOT IN (
      'b01352e3-1cef-4289-8927-e2cecb666803',
      '7143c4f4-e51b-4a69-bcc0-5d8c392ae4ca'
    )
    AND (
      (
        s.account_activated_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM step3a_activated_before b
          WHERE b.user_id = s.user_id
            AND b.account_activated_at IS NOT DISTINCT FROM s.account_activated_at
        )
      )
      OR EXISTS (
        SELECT 1
        FROM step3a_activated_before b
        WHERE b.user_id = s.user_id
          AND b.account_activated_at IS DISTINCT FROM s.account_activated_at
      )
    );

  IF collateral <> 0 THEN
    RAISE EXCEPTION
      'Step 3A aborted: % non-target account_activated_at value(s) changed',
      collateral;
  END IF;
END $$;

COMMIT;
