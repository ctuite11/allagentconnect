#!/usr/bin/env bash
# Hot Sheet draft tests in a DISPOSABLE local Postgres cluster (temp dir).
# No production connection, no network, no email provider.
set -euo pipefail
MIGRATION="drizzle/migrations/0038_hot_sheet_drafts.sql"
PGDIR="$(mktemp -d /tmp/hs-draft-pg-XXXXXX)"; SOCK="$PGDIR/sock"; mkdir -p "$SOCK"
cleanup() { pg_ctl -D "$PGDIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PGDIR"; }
trap cleanup EXIT
AS_PG=(); if [ "$(id -u)" = "0" ]; then chown -R 1000:1000 "$PGDIR"; AS_PG=(setpriv --reuid 1000 --regid 1000 --clear-groups); fi
"${AS_PG[@]}" initdb -D "$PGDIR/data" -U postgres --auth=trust >/dev/null
"${AS_PG[@]}" pg_ctl -D "$PGDIR/data" -o "-k $SOCK -c listen_addresses=''" -l "$PGDIR/log" -w start >/dev/null
unset PGPASSWORD PGSERVICE PGSSLMODE
export PGHOST="$SOCK" PGPORT=5432 PGUSER=postgres PGDATABASE=hsdraft
createdb hsdraft
psql -v ON_ERROR_STOP=1 -q -f supabase/tests/db/10_hot_sheet_drafts_fixture.sql
psql -v ON_ERROR_STOP=1 -q -f "$MIGRATION"
psql -v ON_ERROR_STOP=1 -f supabase/tests/db/11_hot_sheet_drafts_behavior.sql
