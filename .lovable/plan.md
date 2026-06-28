## Pin agent-side email CTAs to allagentconnect.com

### New shared module
Create `supabase/functions/_shared/aacPublicUrl.ts`:
- Exports `AAC_PUBLIC_URL = "https://allagentconnect.com"`.
- Exports `resolveAacCtaUrl(candidate, fallbackPath = "/auth")` that returns `candidate` only when its hostname is `allagentconnect.com` (or a subdomain); otherwise returns `${AAC_PUBLIC_URL}${fallbackPath}`. Logs a warning on rejection. Never throws.

### Functions to update (agent-side only)
For each, remove the `PUBLIC_SITE_URL` env read and use `AAC_PUBLIC_URL` / `resolveAacCtaUrl`:

1. **`send-license-verified-email`** — `ctaUrl = resolveAacCtaUrl(body.ctaUrl, "/auth")`. Final default: `https://allagentconnect.com/auth`.
2. **`send-agent-forward-invite`** — `ctaUrl = resolveAacCtaUrl(body.ctaUrl, "/register")`.
3. **`generate-agent-setup-link`** — `SETUP_REDIRECT` already hard-codes `allagentconnect.com`; leave the literal but switch to `${AAC_PUBLIC_URL}/auth/callback?type=recovery&setup=1` for consistency. No behavior change.
4. **`send-agent-invite`** — agent-to-agent forward; `registerUrl = ${AAC_PUBLIC_URL}/register`. Drop the `allagentconnect.lovable.app` fallback.
5. **`send-seller-alert`** — agent-facing alert; `baseUrl = AAC_PUBLIC_URL`. Drop the `.lovable.app` fallback.
6. **`convert-early-access-to-account`** — agent password-setup redirect; `publicSiteUrl = AAC_PUBLIC_URL`.
7. **`send-verification-submitted`** — already uses `allagentconnect.com` literals; verify only, no edit.

### Out of scope (do NOT touch)
- Buyer invite / hot-sheet / client-acceptance functions.
- `send-listing-share` and any DCMLS consumer flows.
- `process-email-queue`, queue infrastructure, deliverability headers.

### Deploy + verify
1. Deploy the 6 modified functions.
2. POST `/send-license-verified-email` with `{"to":"chris@allagentconnect.com"}`.
3. Query the latest `email_jobs` row for that template and confirm the rendered HTML CTA `href` is exactly `https://allagentconnect.com/auth`.
4. Report the verified href back.