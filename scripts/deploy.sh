#!/usr/bin/env bash
# Deploy frontend: build, then Netlify production deploy (if CLI + auth are set).
# Lovable-hosted flow: README — Share → Publish (no script).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Install & build"
npm install
npm run build

if ! command -v netlify >/dev/null 2>&1; then
  echo ""
  echo "Netlify CLI not found. Install: npm i -g netlify-cli"
  echo "Then: netlify login && netlify link"
  echo "Or publish from Lovable: Share → Publish"
  exit 0
fi

if [[ "${NETLIFY_AUTH_TOKEN:-}" == "" ]]; then
  echo ""
  echo "NETLIFY_AUTH_TOKEN is not set. For CI, create a token at:"
  echo "https://app.netlify.com/user/applications#personal-access-tokens"
  echo ""
  echo "Interactive deploy: netlify deploy --prod --dir=dist"
  exit 0
fi

echo "==> Netlify deploy (production)"
netlify deploy --prod --dir=dist
