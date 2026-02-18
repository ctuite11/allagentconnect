#!/usr/bin/env bash
set -euo pipefail

# Fail if any esm.sh import uses floating versions: @2, @latest, @^, @~
if rg -n 'https://esm\.sh/[^"]+@(latest|\^|~)|https://esm\.sh/[^"]+@2(?!\.)' supabase/functions; then
  echo ""
  echo "❌ Floating esm.sh imports found. Pin to an exact version (e.g. @2.39.3)."
  exit 1
fi

# Fail if any deno std import is unpinned or not exact
if rg -n 'https://deno\.land/std@(latest|\^|~)|https://deno\.land/std@(?![0-9]+\.[0-9]+\.[0-9]+)' supabase/functions; then
  echo ""
  echo "❌ Unpinned deno std imports found. Pin to an exact version (e.g. std@0.190.0)."
  exit 1
fi

echo "✅ Edge imports are pinned (no floating versions)."
