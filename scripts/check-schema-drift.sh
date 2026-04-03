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

# Strip session tokens and version lines that change between dumps
normalize() {
  grep -v '^\\restrict ' | grep -v '^\\unrestrict ' | grep -v '^-- Dumped by' | md5sum | cut -d' ' -f1
}

HASH_COMMITTED=$(normalize < "$SNAPSHOT")
HASH_LIVE=$(normalize < "$TEMPFILE")

if [ "$HASH_COMMITTED" = "$HASH_LIVE" ]; then
  echo "✓ Schema matches committed snapshot. No drift detected."
  exit 0
else
  echo "✗ SCHEMA DRIFT DETECTED"
  echo ""
  echo "Committed: $HASH_COMMITTED"
  echo "Live:      $HASH_LIVE"
  echo ""
  echo "Run 'npm run db:snapshot' and commit the updated file."
  exit 1
fi
