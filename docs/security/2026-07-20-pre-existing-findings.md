# Pre-existing Security Findings — Deferred (2026-07-20)

These findings existed prior to the listing-price validation release
(migration `20260720190000_listings_non_draft_pricing_check.sql`) and were
**intentionally not addressed** in that deployment. They are recorded here
so they can be audited and fixed in a dedicated security pass without
mixing unrelated changes into an unrelated release.

Status: **acknowledged, deferred**. Not ignored in the scanner — findings
remain open so they stay visible until fixed.

## 1. Unauthenticated email trigger endpoints
- Scanner ID: `agent_security / email_triggers_no_auth` (OPEN_ENDPOINTS)
- Category: Email Abuse
- Files:
  - `netlify/functions/send-password-changed-email.ts`
  - `netlify/functions/send-pending-approval-email.ts`
- Risk: Anyone can trigger official-looking transactional emails to
  arbitrary addresses (phishing / spam vector).
- Suggested fix (later): require a shared server-to-server secret header,
  restrict CORS, and only call from authenticated server flows.

## 2. Showing-request submission has auth disabled
- Scanner ID: `agent_security / request_showing_auth_disabled` (OPEN_ENDPOINTS)
- Category: Spam Vector
- File: `netlify/functions/request-showing.ts` (`REQUIRE_AUTH = false`)
- Risk: Unauthenticated inserts to `showing_requests` via service role and
  confirmation email sent to attacker-controlled address; HTML injection
  via unescaped `requesterName` / `mlsNumber`.
- Suggested fix (later): flip `REQUIRE_AUTH = true` once agent auth is
  confirmed, or add captcha/shared-secret; HTML-escape all interpolated
  values in `buildRequesterEmail` / `buildInternalEmail`.

## 3. Stored XSS in EmailDetailDrawer
- Scanner ID: `agent_security / xss_email_detail_drawer` (INPUT_VALIDATION)
- Category: Stored HTML Rendering
- File: `EmailDetailDrawer` component (renders message body via
  `dangerouslySetInnerHTML` without sanitization)
- Risk: Stored HTML/script in campaign message bodies executes in the
  agent's browser.
- Suggested fix (later): sanitize with DOMPurify (or equivalent) before
  rendering, or render as text.

## Explicitly out of scope for this release
- Any code change to the four files above.
- Any `manage_security_finding` ignore/fix operation.

## Next steps
Track as a dedicated security task. Address each finding in its own PR so
regressions can be attributed cleanly.