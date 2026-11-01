#!/usr/bin/env bash
# Privacy lockdown tests in a DISPOSABLE local Postgres (temp dir). FAKE data only.
# No production connection: all PG* vars are unset; unix socket in a temp dir; no TCP.
set -euo pipefail
PORT=5434
PGDIR="$(mktemp -d /tmp/privacy-pg-XXXXXX)"; SOCK="$PGDIR/sock"; mkdir -p "$SOCK"
cleanup() { pg_ctl -D "$PGDIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PGDIR"; }
trap cleanup EXIT
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE PGSSLMODE DATABASE_URL SUPABASE_DB_URL
AS_PG=(); if [ "$(id -u)" = "0" ]; then chown -R 1000:1000 "$PGDIR"; AS_PG=(setpriv --reuid 1000 --regid 1000 --clear-groups); fi
"${AS_PG[@]}" initdb -D "$PGDIR/data" -U postgres --auth=trust >/dev/null
"${AS_PG[@]}" pg_ctl -D "$PGDIR/data" -o "-k $SOCK -p $PORT -c listen_addresses=''" -l "$PGDIR/log" -w start >/dev/null
export PGHOST="$SOCK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=privacy
createdb privacy
echo "ISOLATION: server=$(psql -Atc 'select inet_server_addr() is null') (true = local unix socket only), db=$(psql -Atc 'select current_database()'), listings=$(psql -Atc 'select 1' 2>/dev/null)"
psql -v ON_ERROR_STOP=1 -q -f supabase/tests/db/20_privacy_lockdown_fixture.sql
run() { psql -v ON_ERROR_STOP=1 -q -At -F' | ' <<SQL
\i supabase/tests/db/21_privacy_lockdown_behavior.sql
SELECT r.who, p.label, pg_temp.probe(r.role_name, r.uid, p.label, p.q) FROM roles_t r CROSS JOIN probes p ORDER BY r.ord, p.label;
SQL
}
echo "=== BEFORE (current production behaviour, fake data) ==="; run > "$PGDIR/before.txt"; cat "$PGDIR/before.txt"
psql -v ON_ERROR_STOP=1 -q -f docs/privacy-lockdown/01_lockdown_up.sql
echo "=== AFTER LOCKDOWN ==="; run > "$PGDIR/after.txt"; cat "$PGDIR/after.txt"
psql -v ON_ERROR_STOP=1 -q -f docs/privacy-lockdown/02_lockdown_down.sql
echo "=== AFTER ROLLBACK ==="; run > "$PGDIR/rollback.txt"; cat "$PGDIR/rollback.txt"
# Assertions
fail=0
grep '^signed-out' "$PGDIR/after.txt" | grep -v ' | DENIED$' && { echo "FAIL: signed-out got data after lockdown"; fail=1; }
for w in invited unverified restricted; do grep "^$w |" "$PGDIR/after.txt" | grep -vE ' \| (0|DENIED)$' && { echo "FAIL: $w got data"; fail=1; }; done
grep '^verified agent | profile: hidden agent | 0$' "$PGDIR/after.txt" >/dev/null || { echo "FAIL: hidden agent visible to others"; fail=1; }
grep '^verified agent | profile: invited agent | 0$' "$PGDIR/after.txt" >/dev/null || { echo "FAIL: invited agent visible"; fail=1; }
grep '^verified agent | listings_public rows | 3$' "$PGDIR/after.txt" >/dev/null || { echo "FAIL: verified agent lost listings"; fail=1; }
grep '^hidden agent (self) | profile: hidden agent | 1$' "$PGDIR/after.txt" >/dev/null || { echo "FAIL: hidden agent cannot see own profile"; fail=1; }
grep '^signed-out' "$PGDIR/rollback.txt" | grep -v ' | DENIED$' && { echo "FAIL: rollback reopened data to signed-out visitors"; fail=1; }
grep '^verified agent | listings_public rows | 3$' "$PGDIR/rollback.txt" >/dev/null || { echo "FAIL: rollback did not restore agent access"; fail=1; }
[ $fail = 0 ] && echo "ALL PRIVACY LOCKDOWN ASSERTIONS PASSED" || exit 1
