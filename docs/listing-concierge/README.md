# Listing reminders + Concierge — handover for Weborik migration

Status: STAGED ONLY. Nothing applied to production; reminder cron job 7 stays inactive; no emails sent.

## Decisions (Chris, 2026-11-01)
- Initial audience: listings never updated since publish (18 listings / 18 agents at review time).
- Weekly run; max one reminder per listing per 30 days.
- "Still accurate" click counts as an update and ends reminders for that listing.
- Meaningful change = price, photos, description, status, address, compensation, disclosures.
- Respect email_unsubscribes (category all or listing_reminders).
- Only the listing agent (or their delegate) may approve/publish; staff only propose.
- Sold captures actual closing date, final sale price, buyer-agent fee ACTUALLY PAID (percent / amount / none / unknown).

## Files
- `01_listing_concierge.sql` — schema, RPCs, RLS (apply in Nenad's environment first).
- `tests/run.sh` — 29 checks on a disposable local Postgres with fake data (all pass).

## Still to build in Nenad's environment (would go live if built on the current site)
1. Rewrite `send-stale-listing-reminders` to call `listing_reminder_candidates()` once and `claim_listing_reminder()` per send (replaces ~3 lookups per listing). New email copy per approved preview.
2. Pages: `/agent/listings/:id/confirm`, `/agent/listings/:id/concierge`, `/agent/concierge/:requestId/review`, admin `/admin/concierge`. All behind sign-in; RouteGuard redirect must preserve the return URL.
3. Private storage bucket `concierge-uploads` (path `<agent_id>/<request_id>/…`).
4. Admin notification on submit and agent "review ready" email: one recipient each, idempotency key per request.
5. Enable the weekly schedule in ONE environment only, after cut-over. Never in both.

## Revisions 2026-11-01
See `02-revisions-2026-11-01.md` (Edit Listing status menu reuse, assistant copies, "Still accurate" confirmation, Edit Listing entry point, two new emails). Email templates are in `emails/`. Items 2–4 above are replaced where that file differs.
