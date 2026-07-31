#!/usr/bin/env bash
# Run Ground Zero / PR #33 SQL suites against the local Supabase DB only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "== run-email-sql-tests (local only) =="

DB_URL="$(supabase status -o env 2>/dev/null | awk -F= '/^DB_URL=/{print substr($0, index($0,$2)); exit}')"
if [[ -z "${DB_URL}" ]]; then
  # Fallback: standard local URL from supabase start
  DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
fi

if [[ "$DB_URL" != *"127.0.0.1"* && "$DB_URL" != *"localhost"* ]]; then
  echo "::error::Refusing non-local DB_URL"
  exit 1
fi

echo "Using local DB_URL host check: localhost/127.0.0.1 OK"

run_sql() {
  local file="$1"
  echo "--- psql: $file"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$file"
}

# 1) PR #33 stream immutability (BEGIN/ROLLBACK inside file)
run_sql "supabase/tests/email_jobs_stream_immutability.sql"
echo "PR #33 stream immutability SQL: PASS"

# 2) Ground Zero abuse matrix (BEGIN/ROLLBACK inside file)
run_sql "supabase/tests/email_ground_zero_abuse_matrix.sql"
echo "Ground Zero abuse matrix: PASS"

# 3) Confirm Ground Zero control-plane migrations applied + pauses true
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  s public.email_control_state%ROWTYPE;
BEGIN
  SELECT * INTO STRICT s FROM public.email_control_state WHERE id = true;
  IF s.ground_zero_at IS DISTINCT FROM '2026-07-31 04:00:00+00'::timestamptz THEN
    RAISE EXCEPTION 'unexpected ground_zero_at %', s.ground_zero_at;
  END IF;
  IF s.global_paused IS NOT TRUE
     OR s.hot_sheet_paused IS NOT TRUE
     OR s.communications_paused IS NOT TRUE
     OR s.transactional_paused IS NOT TRUE
     OR s.system_paused IS NOT TRUE THEN
    RAISE EXCEPTION 'expected all DB stream pauses true, got %', to_jsonb(s);
  END IF;
END;
$$;
SQL
echo "Ground Zero migrations 50000–50300: PASS (control state present, pauses true)"

# 4) Rollback left no synthetic test residue
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  n integer;
BEGIN
  SELECT COUNT(*) INTO n
  FROM public.email_jobs
  WHERE idempotency_key LIKE 'test:gz:%'
     OR idempotency_key LIKE 'test:stream-immutability:%'
     OR payload->>'to' LIKE '%@example.com';

  IF n <> 0 THEN
    RAISE EXCEPTION 'rollback left % synthetic email_jobs rows', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM public.email_source_events
  WHERE source_event_id LIKE 'test-event-%';

  IF n <> 0 THEN
    RAISE EXCEPTION 'rollback left % synthetic email_source_events rows', n;
  END IF;
END;
$$;
SQL
echo "Rollback leaves no test data: PASS"
