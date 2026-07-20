## Scope

Publish the scoped listing-price validation release using the existing All Agent Connect publishing configuration only. Do not change any domain, slug, or deployment architecture.

## Pre-publish check (shared-deployment safety)

1. Call `project_urls--get_urls` and `publish_settings--get_publish_settings` to confirm:
   - Lovable URL is `allagentconnect.lovable.app`.
   - Custom domains currently attached: `allagentconnect.com`, `directconnectmls.com`, `www.directconnectmls.com`.
2. Because both AAC and DCMLS custom domains are attached to the **same Lovable project (id `95492335-3a75-4285-8d44-828003cae42a`)**, a single publish of this project will update the frontend build served on every attached domain — including the DCMLS domains. There is no per-domain build in Lovable hosting.
3. **Stop before calling `preview_ui--publish`** and surface this to the user with:
   - The exact list of domains that will receive the new build.
   - The fact that DCMLS shares this deployment.
   - Await explicit confirmation to proceed anyway, or instructions to split domains onto separate projects first.

## If (and only if) the user confirms after the shared-deployment disclosure

1. Call `preview_ui--publish` with **no** `slug` argument (keeps `allagentconnect` subdomain, no domain reconfiguration).
2. Do not call `publish_settings--update_visibility`, do not touch domain settings, do not change slug.

## Do NOT modify in this release
- `netlify/functions/send-password-changed-email.ts`
- `netlify/functions/send-pending-approval-email.ts`
- `netlify/functions/request-showing.ts`
- `EmailDetailDrawer`
- Any domain, DNS, slug, or visibility configuration.
- Any `manage_security_finding` state — the four deferred findings stay open.

## Security follow-up doc
Already created this turn at `docs/security/2026-07-20-pre-existing-findings.md` with scanner IDs. No further security-tool calls.

## Post-publish report to user
- Exact Lovable deploy URL returned by the tool.
- Confirmation `allagentconnect.com` is serving the new build (primary AAC domain remains attached).
- Explicit statement of which DCMLS domains share the same deployment and therefore also received the new build.
- Migration status (`20260720190000_listings_non_draft_pricing_check.sql` — already applied; not re-run).
- Confirmation the four security findings remain open and unchanged, with a link to `docs/security/2026-07-20-pre-existing-findings.md`.

## Explicitly out of scope
- Any code change to the four flagged surfaces.
- Any `manage_security_finding` ignore/fix calls.
- Any domain, slug, visibility, or DNS change.
- Any migration beyond what was already applied.
