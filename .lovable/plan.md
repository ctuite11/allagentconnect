# Plan: Cut transactional email over to `notify.allagentconnect.com`

Goal: get Contact Agent, buyer inquiries, password resets, and all other transactional sends onto a fresh, clean-reputation sender today. DMARC reporting mailbox and `mail.` recovery are deferred — separate, lower-priority tracks.

---

## Phase 1 — Provision `notify.allagentconnect.com` in Resend

You'll do these steps in the Resend dashboard:

1. **Resend → Domains → Add Domain** → enter `notify.allagentconnect.com`. Region: same as the existing `mail.` domain (US East, presumably).
2. Resend will show **3 DNS records**. They follow this exact shape (Resend will give you the exact values — copy what Resend shows, not what's below):

   | Type | Host / Name | Value | Priority | TTL |
   |---|---|---|---|---|
   | MX | `send.notify.allagentconnect.com` | `feedback-smtp.<region>.amazonses.com` | 10 | Auto |
   | TXT (SPF) | `send.notify.allagentconnect.com` | `v=spf1 include:amazonses.com ~all` | — | Auto |
   | TXT (DKIM) | `resend._domainkey.notify.allagentconnect.com` | `p=MIGfMA0GCSqGSIb3DQE...` (long key from Resend) | — | Auto |

3. Add all 3 at the registrar exactly as shown in Resend. Do **not** add anything for the apex `notify.allagentconnect.com` itself.
4. **Do not touch** existing `mail.allagentconnect.com` or root `allagentconnect.com` records.
5. Click **Verify** in Resend. Typical verification: 5–30 minutes once DNS propagates.
6. While there: confirm in Resend that **Click Tracking** and **Open Tracking** are **OFF** for this domain. We do our own tracking for marketing, and Resend's link rewriting hurts transactional deliverability.

DMARC: the existing `_dmarc.allagentconnect.com` record already covers `notify.` via the org-level policy. No new DMARC record needed.

---

## Phase 2 — Code changes (single commit, ready to deploy the moment Resend verifies)

The transactional sender is centralized behind two env vars: `TRANSACTIONAL_FROM` and `TRANSACTIONAL_FROM_EMAIL`. Last cutover already wired most call sites through these. This phase finishes the job and switches the **default fallback** so nothing depends on env vars being set correctly in two places.

### 2a. Update default fallbacks

Change every hardcoded fallback from `hello@mail.allagentconnect.com` → `hello@notify.allagentconnect.com` in:

- `supabase/functions/_shared/sendEmail.ts` — `FROM_EMAIL` default
- `supabase/functions/send-contact-email/index.ts` — `from` fallback
- `supabase/functions/send-showing-request-email/index.ts` — `from` fallback
- `supabase/functions/send-agent-approval-email/index.ts`
- `supabase/functions/send-agent-invite/index.ts`
- `supabase/functions/send-agent-profile-contact/index.ts`
- `supabase/functions/send-auth-email/index.ts`
- `supabase/functions/send-license-upload-notification/index.ts`
- `supabase/functions/send-password-reset/index.ts`
- `supabase/functions/send-price-change-notification/index.ts`
- `supabase/functions/send-verification-submitted/index.ts`
- `supabase/functions/send-welcome-email/index.ts`
- `supabase/functions/convert-early-access-to-account/index.ts`
- `supabase/functions/submit-early-access/index.ts`
- `netlify/edge-functions/request-password-reset.ts`
- `netlify/functions/email-worker.ts`
- `netlify/functions/send-password-changed-email.ts`
- `netlify/functions/send-pending-approval-email.ts`

### 2b. Leave bulk untouched

`supabase/functions/send-bulk-email/index.ts` stays gated by `BULK_EMAIL_PAUSED` and continues to use `mail.allagentconnect.com` when eventually unpaused. **Bulk and transactional must never share a sender again.**

### 2c. Update env vars (in Lovable Cloud + Netlify)

| Variable | New value | Where |
|---|---|---|
| `TRANSACTIONAL_FROM` | `All Agent Connect <hello@notify.allagentconnect.com>` | Supabase Edge Functions + Netlify |
| `TRANSACTIONAL_FROM_EMAIL` | `hello@notify.allagentconnect.com` | Supabase Edge Functions + Netlify |
| `BULK_FROM` (new, optional, for clarity) | `All Agent Connect <hello@mail.allagentconnect.com>` | Supabase only, scoped to `send-bulk-email` |

`RESEND_API_KEY` stays the same — Resend keys are workspace-scoped and already cover any verified domain.

---

## Phase 3 — Deploy

The moment Resend shows `notify.allagentconnect.com` as **Verified**:

**Supabase Edge Functions to redeploy** (all transactional senders):
```
send-contact-email
send-showing-request-email
send-agent-approval-email
send-agent-invite
send-agent-profile-contact
send-auth-email
send-license-upload-notification
send-password-reset
send-price-change-notification
send-verification-submitted
send-welcome-email
convert-early-access-to-account
submit-early-access
process-email-queue   (uses _shared/sendEmail.ts)
```

**Netlify functions to redeploy** (whole site redeploy covers all):
```
netlify/edge-functions/request-password-reset.ts
netlify/functions/email-worker.ts
netlify/functions/send-password-changed-email.ts
netlify/functions/send-pending-approval-email.ts
```

---

## Phase 4 — Verification (within 15 min of cutover)

1. From the live site, trigger **Contact Agent** to a Gmail address you control → confirm **Inbox**, not Spam.
2. Trigger **password reset** to Gmail + Outlook → confirm Inbox.
3. Open the received email's "Show original" in Gmail → confirm:
   - `From: hello@notify.allagentconnect.com`
   - `SPF: PASS (amazonses.com)`
   - `DKIM: PASS (resend._domainkey.notify.allagentconnect.com)`
   - `DMARC: PASS`
4. Trigger a showing request to an Outlook address → confirm Inbox.
5. Check Supabase function logs for any 422 from Resend (would indicate a function still hardcoded to `mail.`).

---

## Phase 5 — Deferred items (explicitly NOT in this cutover)

These are tracked separately so they don't block today's deliverability fix:

1. **`dmarc@allagentconnect.com` mailbox** — needs provisioning at the email host (Google Workspace / wherever `hello@` is hosted). Until then, aggregate reports bounce silently. Acceptable for ~1 week. Add as a follow-up task.
2. **`mail.allagentconnect.com` reputation recovery** — leave it alone. Bulk is hard-paused. No action needed; reputation will recover over weeks of zero sends.
3. **DMARC `p=none` → `p=quarantine` escalation** — defer until both `mail.` and `notify.` show 1+ week of 100% aligned reports.

---

## Timeline

| Step | Time |
|---|---|
| Add 3 DNS records at registrar | 5 min |
| DNS propagation + Resend verification | 5–30 min |
| Deploy code + env var updates | 5 min |
| Verification sends to Gmail/Outlook | 5 min |
| **Total from "start" to production cutover** | **~30–60 min** |

Expected deliverability improvement: **immediate** for any provider that scores per-subdomain (Gmail, Outlook, Yahoo all do). New subdomain starts with neutral reputation; with clean transactional-only traffic it stays neutral-to-good indefinitely.

---

## What I need from you to start

Confirm this plan, then add the 3 DNS records Resend gives you for `notify.allagentconnect.com` and paste back when Resend shows "Verified". I'll deploy the code + env changes the moment you confirm.
