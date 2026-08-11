# Fix the slow "spinning" verify in Admin Approvals

## What actually happened with Fiona

Verified against the live data — the verification itself was clean, **nothing sent twice**:

- One account: `fiona.mcmahon@donnellyandco.com`, created 15:00:09 UTC.
- Agent settings: `verified`, verified_at 15:00:11, not yet activated.
- **One** activation token issued (15:00:13), still unredeemed, expires Aug 18.
- **One** License Verified email job, status `sent`, provider confirmed `delivered` at 15:01:03.

So she received exactly one email and holds exactly one valid setup link.

## Why it looked stuck / like a double send

After a successful verify, the page runs a **full blocking reload of the entire agent list** before the UI settles. That call scans every auth user, profile, settings row and early-access record — it took about **10 seconds** for this verify (and had already run once on page entry). During those seconds the row keeps showing a spinner with no visible result, which reads as "it's hung, did it fire twice?".

## The fix (UI/behavioral only — no change to verify or email logic)

1. **Stop blocking on the reload.** After a successful verify, update that agent's row immediately from the response (verified, activation email queued), then refresh the list in the background instead of holding the spinner.
2. **Clear the per-row spinner as soon as the verify call returns**, not after the list reload finishes.
3. **Collapse duplicate refreshes.** If a list refresh is already in flight, reuse it instead of starting a second one.
4. **Guard the Verify control** so a second click while a verify is in flight is ignored (the row is already tracked in `processingIds`; the button needs to honor it).

## Technical notes

- File: `src/pages/AdminApprovals.tsx` — `fetchAgents`, `handleStatusChange` (both the `pending_verification` and canonical branches), and the row/drawer Verify buttons.
- No changes to `admin-verify-agent`, `send-license-verified-email`, token issuance, or `email_jobs`. Idempotency and the single-email guarantee stay exactly as they are.
- No re-enqueue, retry, or resend of any email job.

Separately (not part of this change): `admin-list-agents` takes 5–11s per call. I can plan a follow-up to paginate/cache it so the whole page feels faster.