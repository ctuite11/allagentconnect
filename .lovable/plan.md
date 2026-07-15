# Admin Agent List — Activation Audit (v2, with link-expiration check)

## What "Activate: No" means
The Activated badge in `AdminApprovals.tsx` is driven **solely** by `agent_settings.account_activated_at` (aliased as `n` in `admin-list-agents`). It flips to Yes only when the agent completes `/agent-setup` and `admin-set-user-password` writes that timestamp. It is independent of role, verification, or auth-user existence.

## Findings (live DB)

Cohort: `agent_profiles` joined to `agent_settings` where `account_activated_at IS NULL`.

| Metric | Count |
|---|---|
| Total profiles | 241 |
| Not activated | **112** |
| Of those: `agent_status = 'verified'` | 112 (100%) |
| Missing `user_roles` row (`role='agent'`) | 0 |
| Missing `verified_at` | 0 |
| Bucket A — verified, never got License Verified email (`approval_email_sent=false`) | **59** |
| Bucket B — got the email but never completed setup | **53** |

Roles and verification are already in place. The problem is entirely on the email/self-serve side. Bucket A begins abruptly on 2026-06-29 — points to a regression that verifies agents without enqueueing `send-license-verified-email`. Bucket B is normal drop-off compounded by expired one-time links.

## Link-expiration audit (per your instruction)

Traced the reminder path end-to-end:

- **UI entry point:** `AdminApprovals.tsx` → `handleBulkActivationReminder` → `handleEmailSetupLink(agent)` (line 1263).
- Every call runs `generateSetupLink(agent)` first, which invokes the `generate-agent-setup-link` edge function. That function calls `admin.auth.admin.generateLink({ type: "recovery", ... })` at request time — **a brand-new recovery token per reminder**. No URL is read back from the original `email_jobs` payload.
- The fresh URL is wrapped in the AAC redirector (`/auth/setup?next=<base64url>`) inside `send-license-verified-email` and delivered as the CTA. Recipients arrive at `/auth/callback?type=recovery&setup=1` → password setup → `/agent-setup`.
- **Dedupe risk:** `send-license-verified-email` blocks any License Verified job for the same recipient within the last 10 minutes AND applies a daily idempotency key (`license-verified:<email>:YYYYMMDD`). For legitimate reminders sent days/weeks after the original, neither block fires — reminders go through with the fresh link. Good.

**Conclusion:** the current reminder mechanism *does* generate a fresh link every send. It does not reuse or resend the original `email_jobs` URL. Safe to use — with one caveat below.

**Caveats to verify before sending any reminders:**
1. **Recovery-link TTL is a Supabase Auth setting** we cannot read from the client. Standard default is 3600s (1 hour) unless explicitly raised. The reminder will still fail for anyone who clicks it >TTL later — same failure mode as the original. That is unavoidable without extending the auth config, but is at least *fresh* on send.
2. **Dead-end recovery for expired links.** Right now, if an agent clicks an expired link they land on `/auth/callback` with a Supabase error. There is no explicit "Request a new activation link" CTA on that error state that they can self-serve. That should be added before Bucket B reminders go out.
3. **Idempotency edge case:** if an admin runs the bulk reminder twice within 10 minutes, the second run is silently deduped per recipient by `send-license-verified-email`. Bulk UI should surface skipped-as-deduped separately from failed.

## Proposed fix plan (report-first, no writes yet)

### Step 1 — Ship a downloadable CSV audit (no data changes)
On `AdminApprovals`, add an admin-only "Export activation audit" action returning one row per not-activated agent:
- `email`, `verified_at`, `approval_email_sent`, `days_since_verified`
- latest `email_jobs.status` + `updated_at` for template `license-verified` (or "no job found")
- last reminder sent timestamp (from `email_jobs` most recent `license-verified`)

Deliverable to review Buckets A and B by name before touching data.

### Step 2 — Diagnose Bucket A (why 59 verified agents skipped the email)
Trace the codepath that flipped their `agent_settings.agent_status` to `verified` on/after 2026-06-29. Likely suspects:
- `convert-pending-verification-to-agent` — sets `approval_email_sent: false` and defers email sending to a Phase 3 that may never have shipped for the paths in use.
- The admin "Verify" button in `AdminApprovals.tsx` — confirm the `send-license-verified-email` enqueue still fires and that failures set `approval_email_sent=false` intentionally (vs. throwing silently).

Fix the root cause. No data patch until this is done.

### Step 3 — Add a self-serve recovery page for expired links (prerequisite for Step 5)
Update `/auth/callback` (and the AAC `/auth/setup` redirector) so that when Supabase returns `otp_expired` / `access_denied` after clicking a recovery link, the page shows:
- Plain-English "Your setup link has expired" message.
- A "Request a new activation link" button that calls a new small edge function `request-fresh-activation-link` which:
  - Looks up the email via the expired token or asks the visitor to type it.
  - If the email matches a verified, not-yet-activated agent, enqueues a fresh License Verified email.
  - Silently no-ops otherwise (no enumeration).

This guarantees no reminder can land an agent in a dead end.

### Step 4 — Bucket A backfill (after Step 2 root cause is fixed)
Behind a confirmation dialog on `AdminApprovals`, offer "Send License Verified to N verified agents who never received it (Bucket A)":
- Iterates the 59 emails, calls `send-license-verified-email` with a per-agent fresh `ctaUrl` from `generateSetupLink` (same path as reminders), acknowledgeDeleted only for admin-confirmed items.
- On successful enqueue, flips `agent_settings.approval_email_sent = true`.
- Progress + failure summary shown; nothing hidden.

### Step 5 — Bucket B reminders (only after Steps 3 & 4)
Use the existing bulk reminder action for the 53 agents. Two small UX fixes to land first:
- Report skipped-as-deduped separately from failed.
- Show which agents had a reminder sent in the last 7 days (stale reminders spam) and default-unselect them.

### Step 6 — Guardrail (nightly)
Edge function or scheduled query that flags any `agent_settings` row where `agent_status='verified'` AND `verified_at < now() - 24h` AND `approval_email_sent=false`. Count surfaces in Admin Debug so the Bucket A regression can't hide again.

## Files likely to change (Steps 1–3 only)
- `src/pages/AdminApprovals.tsx` — CSV export + bulk-reminder UX tweaks
- `supabase/functions/admin-list-agents/index.ts` — join in `email_jobs` status for the License Verified template
- `src/pages/AuthCallback.tsx` (and/or `src/pages/AuthSetupRedirect.tsx`) — expired-link recovery UI
- **New** `supabase/functions/request-fresh-activation-link/index.ts` — self-serve fresh link
- Whichever verify handler is identified in Step 2

## Answer to your specific concerns
- **"Does the reminder generate a fresh link at send time?"** Yes — confirmed via code trace. Every reminder calls `generateSetupLink` → `auth.admin.generateLink({type:'recovery'})` fresh.
- **"Does it reuse the original `email_jobs` URL?"** No.
- **"Does the fresh link route through `/auth/callback?type=recovery&setup=1` → `/agent-setup`?"** Yes, via `SETUP_REDIRECT`.
- **"Is there a clear way out of an expired link?"** No — Step 3 fixes this before any Bucket B send.
- **"Do we have proof of the link expiration period?"** Not visible from client code; Supabase default is ~1 hour. We can extend if needed, but Step 3 makes the expiration recoverable regardless.

Nothing gets edited or emailed until you approve. Reply to proceed with **Step 1 only** (CSV export + `email_jobs` join) so we can confirm the two buckets by name before anything else.
