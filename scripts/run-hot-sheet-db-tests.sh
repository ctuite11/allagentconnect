#!/usr/bin/env bash
# Behavioural database tests for the Hot Sheet matcher + listing-event dispatcher.
# Spins up a DISPOSABLE local Postgres cluster in a temp dir, loads the fixture
# and the migration, runs the transactional test file (which ROLLBACKs), then
# destroys the cluster. Never touches production and makes no HTTP/provider calls.
set -euo pipefail

# Migrations applied in order (override by passing paths as arguments).
if [ "$#" -gt 0 ]; then
  MIGRATIONS=("$@")
else
  MIGRATIONS=(
    supabase/migrations/20260805070000_hot_sheet_reopening_dispatchers_and_matcher_parity.sql
    supabase/migrations/20260806020527_hot_sheet_residential_rental_and_listing_type_dispatch.sql
  )
fi
PGDIR="$(mktemp -d /tmp/hs-pg-XXXXXX)"
SOCK="$PGDIR/sock"; mkdir -p "$SOCK"

cleanup() { pg_ctl -D "$PGDIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PGDIR"; }
trap cleanup EXIT

# Postgres refuses to run as root; drop to an unprivileged uid when needed.
AS_PG=(); if [ "$(id -u)" = "0" ]; then chown -R 1000:1000 "$PGDIR"; AS_PG=(setpriv --reuid 1000 --regid 1000 --clear-groups); fi

"${AS_PG[@]}" initdb -D "$PGDIR/data" -U postgres --auth=trust >/dev/null
"${AS_PG[@]}" pg_ctl -D "$PGDIR/data" -o "-k $SOCK -c listen_addresses=''" -l "$PGDIR/log" -w start >/dev/null

export PGHOST="$SOCK" PGUSER=postgres PGDATABASE=hstest
createdb -h "$SOCK" -U postgres hstest

psql -v ON_ERROR_STOP=1 -q -f supabase/tests/db/00_fixture.sql
for m in "${MIGRATIONS[@]}"; do
  psql -v ON_ERROR_STOP=1 -q -f "$m"
done
psql -v ON_ERROR_STOP=1 -f supabase/tests/db/01_hot_sheet_matcher_behavior.sql
