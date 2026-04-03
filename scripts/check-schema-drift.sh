#!/usr/bin/env bash
set -euo pipefail

SNAPSHOT="docs/database/schema_snapshot.sql"
TEMPFILE=$(mktemp)

trap 'rm -f "$TEMPFILE"' EXIT

if [ ! -f "$SNAPSHOT" ]; then
  echo "ERROR: No committed snapshot found at $SNAPSHOT"
  echo "Run 'npm run db:snapshot' to generate one."
  exit 1
fi

echo "Dumping current schema..."
pg_dump --schema-only --schema=public > "$TEMPFILE"

if cmp -s "$SNAPSHOT" "$TEMPFILE"; then
  echo "✓ Schema matches committed snapshot. No drift detected."
  exit 0
else
  echo "✗ SCHEMA DRIFT DETECTED"
  echo ""
  echo "The committed snapshot does not match the live database."
  echo "Run 'npm run db:snapshot' and commit the updated file."
  exit 1
fi
