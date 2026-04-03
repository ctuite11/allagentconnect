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

if diff -u "$SNAPSHOT" "$TEMPFILE" > /dev/null 2>&1; then
  echo "✓ Schema matches committed snapshot. No drift detected."
  exit 0
else
  echo "✗ SCHEMA DRIFT DETECTED"
  echo ""
  echo "Differences between committed snapshot and live database:"
  echo "========================================================="
  diff -u "$SNAPSHOT" "$TEMPFILE" || true
  echo ""
  echo "To fix: run 'npm run db:snapshot' and commit the updated file."
  exit 1
fi
