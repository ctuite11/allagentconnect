#!/usr/bin/env bash
# Zero-email verification of the durable Hot Sheet outbox in a DISPOSABLE local
# Postgres cluster. No production database is touched, net.http_post is a
# recording stub, and no email provider is ever contacted.
set -euo pipefail

MIGRATIONS=(
  supabase/migrations/20260805070000_hot_sheet_reopening_dispatchers_and_matcher_parity.sql
  supabase/migrations/20260806020524_bb70d48d-66a6-4b4a-87a8-bb92a905f992.sql
  supabase/migrations/20260816023556_cd18727b-f830-4260-80e1-10e79c76fd60.sql   # A: tables
  supabase/migrations/20260816023646_97b0df52-bab6-4f99-9d21-3efee1d19802.sql   # B: RPCs
  supabase/migrations/20260816024950_7abe8235-3e1f-419b-b006-918e6557c0e0.sql   # C: trigger
)

PGDIR="$(mktemp -d /tmp/hs-outbox-XXXXXX)"
SOCK="$PGDIR/sock"; mkdir -p "$SOCK"
cleanup() { pg_ctl -D "$PGDIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PGDIR"; }
trap cleanup EXIT

AS_PG=(); if [ "$(id -u)" = "0" ]; then chown -R 1000:1000 "$PGDIR"; AS_PG=(setpriv --reuid 1000 --regid 1000 --clear-groups); fi
"${AS_PG[@]}" initdb -D "$PGDIR/data" -U postgres --auth=trust >/dev/null
"${AS_PG[@]}" pg_ctl -D "$PGDIR/data" -o "-k $SOCK -c listen_addresses=''" -l "$PGDIR/log" -w start >/dev/null

export PGHOST="$SOCK" PGUSER=postgres PGDATABASE=hstest
createdb -h "$SOCK" -U postgres hstest

psql -v ON_ERROR_STOP=1 -q -f supabase/tests/db/00_fixture.sql
psql -v ON_ERROR_STOP=1 -q -f supabase/tests/db/02_outbox_fixture.sql
for m in "${MIGRATIONS[@]}"; do psql -v ON_ERROR_STOP=1 -q -f "$m"; done

echo "--- transactional behaviour suite (rolled back) ---"
psql -v ON_ERROR_STOP=1 -f supabase/tests/db/03_hot_sheet_outbox_behavior.sql

echo "--- two-session concurrency (duplicate events, same logical delivery) ---"
psql -v ON_ERROR_STOP=1 -q -f supabase/tests/db/04_concurrency_setup.sql

DELIVERY="SELECT public.enqueue_hot_sheet_delivery(
  '%s'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid, 'active',
  '22222222-2222-2222-2222-222222222222'::uuid, 'agent', 'agent@example.com',
  '{}'::jsonb, '%s', true, 'hot_sheet_emails_paused')"

( printf "BEGIN; %s; SELECT pg_sleep(3); COMMIT;" "$(printf "$DELIVERY" 33333333-3333-3333-3333-333333333333 key-a)" \
    | psql -v ON_ERROR_STOP=1 -t -A > "$PGDIR/a.out" 2>&1 ) &
sleep 1
printf "BEGIN; %s; COMMIT;" "$(printf "$DELIVERY" 44444444-4444-4444-4444-444444444444 key-b)" \
  | psql -v ON_ERROR_STOP=1 -t -A > "$PGDIR/b.out" 2>&1
wait

echo "session A: $(grep -o '"result"[^}]*' "$PGDIR/a.out" | head -1)"
echo "session B: $(grep -o '"result"[^}]*' "$PGDIR/b.out" | head -1)"
grep -q 'paused_held' "$PGDIR/a.out" || { echo "FAIL: session A did not win the claim"; cat "$PGDIR/a.out"; exit 1; }
grep -q 'duplicate'   "$PGDIR/b.out" || { echo "FAIL: session B was not arbitrated as duplicate"; cat "$PGDIR/b.out"; exit 1; }

psql -v ON_ERROR_STOP=1 -f supabase/tests/db/05_concurrency_assert.sql

echo "--- disposable cluster destroyed; nothing persisted ---"
