#!/usr/bin/env bash
# Regression suite for the Hot Sheet "status changes only" rule.
# DISPOSABLE local Postgres cluster: no production database is touched,
# net.http_post is a recording stub, and no email provider is ever contacted.
set -euo pipefail

MIGRATIONS=(
  supabase/migrations/20260805070000_hot_sheet_reopening_dispatchers_and_matcher_parity.sql
  supabase/migrations/20260806020524_bb70d48d-66a6-4b4a-87a8-bb92a905f992.sql
  supabase/migrations/20260816023556_cd18727b-f830-4260-80e1-10e79c76fd60.sql   # A: tables
  supabase/migrations/20260816023646_97b0df52-bab6-4f99-9d21-3efee1d19802.sql   # B: RPCs
  supabase/migrations/20260816024950_7abe8235-3e1f-419b-b006-918e6557c0e0.sql   # C: trigger
  drizzle/migrations/0015_hot_sheet_status_only_dispatch_outbox_only.sql        # D: status-only
)

PGDIR="$(mktemp -d /tmp/hs-status-XXXXXX)"
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

echo "--- status-only trigger suite (rolled back) ---"
psql -v ON_ERROR_STOP=1 -f supabase/tests/db/08_hot_sheet_status_only_trigger.sql

echo "--- disposable cluster destroyed; nothing persisted ---"
