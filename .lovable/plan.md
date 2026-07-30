## Who broke it

Not a person I can name from git — every commit in this repo is authored by the Lovable bot with the message "Changes", so the audit trail points to a **date and a change set**, not a human. The commits came from your own Lovable sessions on **2026-07-11**.

What happened that day:

- `a4a253f2f` (2026-07-11) — **created** `supabase/functions/notify-agents-new-listing/index.ts`. This is a brand-new broadcast function. It never looks at `hot_sheets`. It builds its audience from `getVerifiedAgentAudience` (every activated + verified agent) and filters with `communicationPreferencesMatcher` (Comms Center coverage area / price / property type).
- `2f8baf8ad` (2026-07-11) — **wired it into the listing trigger**, adding the fan-out at `supabase/functions/notify-matching-buyers/index.ts:64-68`, right beside the existing hot-sheet call.
- Same-day follow-ups `f6bd99b9c`, `0c41ee9d4`, `a6ee44a0a`, `ab49f9596`, `1044d2f23` expanded its audience and reminder logic.

The damage is visible in the data: the first `agent-new-listing-alert` email job is timestamped **2026-07-11 03:12 UTC**. There are now **4,977** of them. The real hot-sheet template, `new-match-notification`, dates back to 2026-06-05 and has produced **35**.

The Hot Sheet system you built and tested never broke. A second, parallel pipeline was added on top of the same database trigger, and it labels its output `hot_sheet_alerts` while never consulting a hot sheet.

**Why it was probably added:** `send-new-match-notification` (the canonical realtime path, cron `*/2 * * * *`) only emails buyers/clients — it never emails the agent and ignores `hot_sheets.notify_agent_email`. Only the manual `process-hot-sheet` honors that flag. So agent-facing listing alerts had a real gap, and it was filled with a broadcast instead of by closing the gap in the hot-sheet path.

---

## Answers to your five questions

**1. What invokes `notify-agents-new-listing`**
`notify-matching-buyers/index.ts:64-68` (automatic, every qualifying listing event) and `admin-notification-backfill/index.ts:145-149` (manual admin replay). Nothing else.

**2. When introduced** — 2026-07-11, commits above.

**3. Same event also triggers the hot-sheet path** — yes. DB trigger `notify_matching_buyers_trigger` (AFTER INSERT OR UPDATE ON `listings`) → `notify-matching-buyers` → three fan-outs: `send-new-match-notification`, `notify-agents-new-listing`, plus inline legacy `client_needs` emails.

**4. Duplicates** — each path dedups internally (`agent_sent_listings` vs `hot_sheet_sent_listings`), but there is no cross-path dedup, so one person can receive two or three emails for one listing event.

**5. Which path passed the tests** — `process-hot-sheet` / `send-new-match-notification`. Criteria come from the hot sheet row, delivery is gated on `notification_schedule` / `notify_agent_email` / `notify_client_email`, clients must have accepted an invite.

Last 14 days: 4,782 broadcast alerts to 189 agents. **2** of those agents own an active hot sheet.

---

## Fix: delete the second pipeline, close the gap in the first

**1. Sever the regression.** Remove the fan-out at `notify-matching-buyers/index.ts:60-70`. Make `notify-agents-new-listing` return `{ disabled: true }` immediately so the admin backfill can't fire it either. No property notification uses Comms Center preferences anymore.

**2. Add agent delivery to the canonical path.** In `send-new-match-notification`, for each hot sheet that matched this listing, also deliver to the owning agent when `is_active`, `notify_agent_email = true`, `notification_schedule = 'immediately'`, and the agent isn't the listing agent. Reuse the existing `hot_sheet_sent_listings` `(hot_sheet_id, listing_id, status_at_send)` reservation — one row covers both agent and buyer sends, so no duplicate with `process-hot-sheet`.

Keeps the `agent-new-listing-alert` template and `hot_sheet_alerts` category, but with the real hot sheet name, and uses `hotSheetStatusCopy.ts` wording for status changes vs new matches. Key: `hs-agent:${hot_sheet_id}:${listing_id}:${status}`.

**3. Leave `agent_sent_listings` in place** as history; it just stops being written. `communicationPreferencesMatcher` stays untouched for Buyer Needs / Seller / Renter broadcasts.

**4. Queued backlog.** Unsent `agent-new-listing-alert` jobs exist. I will not cancel or retry any of them without your explicit say-so.

## Result

- No hot sheets → zero property emails.
- Hot sheets that don't match the listing → zero.
- One source of truth: every property alert starts from a hot sheet row.
- Buyer Needs and other Comms Center broadcasts unchanged.

## Verification

Dry-run against a recent listing (expect only the 2 hot-sheet owners, and only on criteria match). Negative tests: no hot sheet, paused hot sheet, non-matching criteria, `notify_agent_email = false`. Re-fire the same event twice to confirm dedup holds. Confirm Buyer Need volumes unchanged.
