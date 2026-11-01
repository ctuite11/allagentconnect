#!/usr/bin/env bash
# Runs the concierge/reminder tests in a DISPOSABLE local Postgres. No production connection.
set -euo pipefail
cd "$(dirname "$0")"
PORT=5434; PGDIR="$(mktemp -d /tmp/concierge-pg-XXXXXX)"; SOCK="$PGDIR/sock"; mkdir -p "$SOCK"
cleanup() { pg_ctl -D "$PGDIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PGDIR"; }
trap cleanup EXIT
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE PGSSLMODE DATABASE_URL
AS_PG=(); if [ "$(id -u)" = "0" ]; then chown -R 1000:1000 "$PGDIR"; AS_PG=(setpriv --reuid 1000 --regid 1000 --clear-groups); fi
"${AS_PG[@]}" initdb -D "$PGDIR/data" -U postgres --auth=trust >/dev/null
"${AS_PG[@]}" pg_ctl -D "$PGDIR/data" -o "-k $SOCK -p $PORT -c listen_addresses=''" -l "$PGDIR/log" -w start >/dev/null
export PGHOST="$SOCK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=concierge
createdb concierge
psql -v ON_ERROR_STOP=1 -q -f 10_fixture.sql
psql -v ON_ERROR_STOP=1 -q -f ../01_listing_concierge.sql
psql -v ON_ERROR_STOP=1 -q -f 11_behavior.sql 2>&1 | grep -E "PASS|FAIL|ERROR"
