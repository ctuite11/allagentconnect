#!/usr/bin/env bash
# Fail closed if this CI job is about to touch a remote/production Supabase project.
set -euo pipefail

echo "== assert-no-production-supabase =="

fail() {
  echo "::error::$1"
  exit 1
}

# Never allow these secrets/env vars in this workflow.
for var in \
  SUPABASE_ACCESS_TOKEN \
  SUPABASE_DB_PASSWORD \
  PRODUCTION_DB_PASSWORD \
  PRODUCTION_PROJECT_ID \
  STAGING_DB_PASSWORD \
  STAGING_PROJECT_ID \
  DATABASE_URL \
  SUPABASE_DB_URL \
  DIRECT_URL \
  POSTGRES_URL
do
  if [[ -n "${!var:-}" ]]; then
    fail "Refusing to run: environment variable $var is set (production/remote risk)."
  fi
done

# RESEND_API_KEY may only be the synthetic CI placeholder.
if [[ -n "${RESEND_API_KEY:-}" && "${RESEND_API_KEY}" != "re_ci_synthetic_do_not_send" ]]; then
  fail "Refusing to run: non-synthetic RESEND_API_KEY is set."
fi

# Refuse known production project refs if someone tries to inject them.
PROD_REFS=(
  "kinifeyelxwiwkrzoerf"
  "qocduqtfbsevnhlgsfka"
)

for ref in "${PROD_REFS[@]}"; do
  if [[ "${SUPABASE_PROJECT_ID:-}" == "$ref" ]] || [[ "${SUPABASE_PROJECT_REF:-}" == "$ref" ]]; then
    fail "Refusing to run: production project ref detected in env ($ref)."
  fi
done

# Scan process environment for remote DB URL patterns.
if env | grep -Eiq 'postgres(ql)?://[^[:space:]]*(supabase\.co|pooler\.supabase\.com)'; then
  fail "Refusing to run: remote Supabase Postgres URL detected in environment."
fi

# Refuse dangerous CLI flags if present in CI script args.
if [[ "$*" == *"--linked"* ]] || [[ "$*" == *" db push"* ]] || [[ "$*" == *" link "* ]]; then
  fail "Refusing to run: forbidden supabase remote operation requested."
fi

# Ensure we are not linked for this job (local-only).
if [[ -f supabase/.temp/project-ref ]]; then
  echo "Removing local supabase/.temp/project-ref to avoid accidental remote targeting."
  rm -f supabase/.temp/project-ref
fi
if [[ -f supabase/.temp/linked-project.json ]]; then
  echo "Removing local supabase/.temp/linked-project.json to avoid accidental remote targeting."
  rm -f supabase/.temp/linked-project.json
fi

echo "OK: no production credentials / remote DB URLs detected for this job."
