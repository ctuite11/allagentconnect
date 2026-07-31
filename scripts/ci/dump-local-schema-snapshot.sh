#!/usr/bin/env bash
# Dump public schema from disposable local Supabase only.
# Refuses any host other than 127.0.0.1 / localhost.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DB_URL="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

# Refuse ambient production connection variables.
for var in DATABASE_URL SUPABASE_DB_URL DIRECT_URL POSTGRES_URL SUPABASE_ACCESS_TOKEN; do
  if [[ -n "${!var:-}" ]]; then
    echo "::error::Refusing schema snapshot: $var is set"
    exit 1
  fi
done

case "$DB_URL" in
  *127.0.0.1*|*localhost*)
    ;;
  *)
    echo "::error::Refusing schema snapshot: host is not local (127.0.0.1/localhost)"
    echo "DB_URL=$DB_URL"
    exit 1
    ;;
esac

# Extra hard check on host component
HOST="$(python3 - <<PY
from urllib.parse import urlparse
u = urlparse("""$DB_URL""")
print(u.hostname or "")
PY
)"
if [[ "$HOST" != "127.0.0.1" && "$HOST" != "localhost" ]]; then
  echo "::error::Refusing schema snapshot: parsed host '$HOST' is not local"
  exit 1
fi

OUT="docs/database/schema_snapshot.sql"
mkdir -p docs/database

pg_dump \
  "$DB_URL" \
  --schema-only \
  --schema=public \
  > "$OUT"

echo "Schema snapshot written to $OUT from local host $HOST"
wc -l "$OUT"
