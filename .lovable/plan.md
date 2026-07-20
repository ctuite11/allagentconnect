## Scope

Publish the already-completed listing-price validation change only. Do not touch the four pre-existing security findings in this release. Record them as a separate follow-up task.

## Actions

1. **Publish scoped change**
   - Call `preview_ui--publish` to deploy the current commit (migration `20260720190000_listings_non_draft_pricing_check.sql` + frontend pricing guards in `AddListing.tsx` / `MyListings.tsx` / reactivate flow).
   - Publishing is currently blocked by 3 critical pre-existing findings. Use the acknowledged-override path if the platform allows it on this call. If the tool still refuses, stop and report back — do not modify the flagged files to force it through.

2. **Do NOT modify in this release**
   - `netlify/functions/send-password-changed-email.ts`
   - `netlify/functions/send-pending-approval-email.ts`
   - `netlify/functions/request-showing.ts`
   - `EmailDetailDrawer` (XSS finding)

3. **Create separate security follow-up record**
   - Add `docs/security/2026-07-20-pre-existing-findings.md` listing the four findings, their scanner IDs (pulled from `security--get_scan_results`), suspected risk, affected files, and status = "acknowledged, deferred, not part of listing-price release."
   - Do not call `security--manage_security_finding` to ignore or mark-as-fixed. Leave findings open in the scanner so they remain visible for the dedicated security pass.

4. **Verify after publish**
   - Confirm publish tool returns a scheduled deploy URL.
   - Confirm no edits landed in the four protected files (git status clean for those paths).
   - Report back with: deploy URL, migration status, and a link to the new security follow-up doc.

## Explicitly out of scope
- Any code change to the four flagged surfaces.
- Any `manage_security_finding` ignore/fix calls.
- Any additional migrations.
