#!/usr/bin/env bash
# Deploy email deliverability fix: secrets + Supabase functions + optional Netlify prod.
# Prerequisites:
#   npx supabase login   (or export SUPABASE_ACCESS_TOKEN)
#   netlify login        (or export NETLIFY_AUTH_TOKEN) — for step 3 only
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Production project (matches .env VITE_SUPABASE_PROJECT_ID)
PROJECT_REF="${SUPABASE_PROJECT_REF:-qocduqtfbsevnhlgsfka}"

CANONICAL_FROM='All Agent Connect <hello@allagentconnect.com>'
CANONICAL_EMAIL='hello@allagentconnect.com'

echo "==> 1. Supabase secrets (project: ${PROJECT_REF})"
npx supabase secrets set \
  --project-ref "$PROJECT_REF" \
  "TRANSACTIONAL_FROM=${CANONICAL_FROM}" \
  "TRANSACTIONAL_FROM_EMAIL=${CANONICAL_EMAIL}" \
  "BULK_EMAIL_PAUSED=true"

echo ""
echo "==> 2. Deploy edge functions (shared sendEmail / transactionalSender)"
FUNCTIONS=(
  process-email-queue
  kick-email-queue
  send-agent-client-email
  send-listing-share
)
for fn in "${FUNCTIONS[@]}"; do
  echo "    deploying ${fn}..."
  npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

echo ""
echo "==> 3. Netlify production deploy (disables email-worker schedule + no-op handler)"
if command -v netlify >/dev/null 2>&1; then
  npm run build
  if [[ -n "${NETLIFY_AUTH_TOKEN:-}" ]]; then
    netlify deploy --prod --dir=dist
  else
    echo "    Run manually: netlify deploy --prod --dir=dist"
    echo "    Or set NETLIFY_AUTH_TOKEN for CI-style deploy."
  fi
else
  echo "    Netlify CLI not installed — redeploy via Lovable Share → Publish"
fi

echo ""
echo "==> Done. Manual verification:"
echo "  1. Supabase Dashboard → Edge Functions → process-email-queue-every-minute cron active"
echo "  2. Netlify → Site env: TRANSACTIONAL_FROM=${CANONICAL_FROM}"
echo "  3. Send My Clients → Custom message; Gmail Show original:"
echo "       From: ${CANONICAL_FROM}"
echo "       Reply-To: your agent email"
echo "       No List-Unsubscribe header"
echo "  4. Supabase logs: search for [sendEmail] from=${CANONICAL_FROM}"
