#!/usr/bin/env bash
# RLS tests for Comms Center broadcast attachments. Disposable local cluster;
# never touches production and sends no email.
set -euo pipefail
MIGRATIONS=("supabase/migrations/20260817183157_767aed59-d616-497b-8752-829cb774d3b9.sql" "supabase/migrations/20260817184151_76dd71a6-7ac6-4d20-9dba-cad72e3b9e88.sql")
if [ "$#" -gt 0 ]; then MIGRATIONS=("$@"); fi
PGDIR="$(mktemp -d /tmp/comms-pg-XXXXXX)"; SOCK="$PGDIR/sock"; mkdir -p "$SOCK"
cleanup() { pg_ctl -D "$PGDIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PGDIR"; }
trap cleanup EXIT
AS_PG=(); if [ "$(id -u)" = "0" ]; then chown -R 1000:1000 "$PGDIR"; AS_PG=(setpriv --reuid 1000 --regid 1000 --clear-groups); fi
"${AS_PG[@]}" initdb -D "$PGDIR/data" -U postgres --auth=trust >/dev/null
"${AS_PG[@]}" pg_ctl -D "$PGDIR/data" -o "-k $SOCK -c listen_addresses=''" -l "$PGDIR/log" -w start >/dev/null
export PGHOST="$SOCK" PGUSER=postgres PGDATABASE=commstest
createdb -h "$SOCK" -U postgres commstest
psql -v ON_ERROR_STOP=1 -q -f supabase/tests/db/06_comms_attachments_fixture.sql
# Storage policies are skipped locally (no storage schema in the disposable cluster).
# Storage policies are skipped locally (no storage schema in the disposable cluster).
for m in "${MIGRATIONS[@]}"; do
  sed -e '/-- Storage policies/,$d' -e '/ON storage.objects/,$d' "$m" | psql -v ON_ERROR_STOP=1 -q -f -
done
psql -v ON_ERROR_STOP=1 -f supabase/tests/db/07_comms_attachments_rls.sql
