# Read-only send preview — 8 pending Comms Center digest items

No code, data, cron, secret, or queue was changed. The digest function was not invoked. Nothing was sent.

## Headline

All 8 pending items are the **same single broadcast**. They are not 8 different communications.

- Pending database items: **8**
- Unique source communications: **1** (broadcast `82225ca1-5376-4a5d-974c-2eb25f4990d2`, "Stager Needed")
- Unique recipients: **8**
- Digest emails that would be created: **8** (one per recipient)
- Items per recipient: **1 each**
- Duplicate / stale / suppressed / ineligible items: **0** found
- Existing `comms_digest_sends` rows: **0** (nothing half-sent)

## The one communication

| Field | Value |
|---|---|
| Source type | broadcast |
| Source ID | 82225ca1-5376-4a5d-974c-2eb25f4990d2 |
| Category | General Discussion (maps to `general_discussion`) |
| Sender | Jarvid Cortes — Keller Williams Realty |
| Title | Stager Needed |
| Criteria shown | State: MA (no property type, no price range, no town/area) |
| Body text | "Who is your go to South Shore home stager?\n\nTahanks!\nJarvid" (sender's typo preserved) |
| Created | 2026-08-03 17:48:21 UTC (13:48 ET) |
| Action URL | https://allagentconnect.com/communications/feed |

## Per-item detail

All 8 items share the source, category, title, criteria, body, and creation timestamp above.

| Item ID | Recipient | Email | Cadence | Master switches | general_discussion | Eligible now | Already received elsewhere |
|---|---|---|---|---|---|---|---|
| 4ce1a615 | Kate Cleary | kcleary@charlesgate.com | daily | both on | on | Yes | No |
| bc877ce7 | Emily Dugal | emily@sellboston.com | daily | both on | on | Yes | No |
| 58a5920c | Alex Genovese | alex@flowrealty.com | daily | both on | on | Yes | No |
| 33c99d14 | Richard Luc | richard.luc@richardhluc.com | daily | both on | on | Yes | No |
| b992622b | Anh Nguyen | anh@serhant.com | daily | both on | on | Yes | No |
| d5459b10 | Sean Packard | seanp@crg123.com | daily | both on | on | Yes | No |
| 461cb2b6 | Josh Stiles | josh.stiles@compass.com | weekly | both on | on | Yes | No |
| fbc4e55e | Andrew Stuckey | andrew@keepitrealty.homes | weekly | both on | on | Yes | No |

Eligibility check performed per recipient: all 8 are `agent_status = verified`, activated, hold the `agent` role, and pass the current opt-in gate (`client_needs_enabled` = true, `new_matches_enabled` = true, `general_discussion` = true). None has an `email_jobs` record for this broadcast, and each has exactly one digest item for it — so no recipient has already received it by an immediate or duplicate path.

Note: three items were queued with `summary.reason = "preferences_unset"` (Cleary, Genovese, Nguyen) — those agents have since configured preferences, and the send-time recheck re-evaluates against current values, so they now pass.

## Resulting emails (as the renderer would group them)

Eight separate emails, each containing exactly one communication.

**Daily — 6 emails** (Cleary, Dugal, Genovese, Luc, Nguyen, Packard)

- Subject: `Your daily Communications Center digest (1 update)`
- Idempotency key: `comms-digest:daily:daily:YYYY-MM-DD:<agent_id>` (period key is the ET calendar date of the run)

**Weekly — 2 emails** (Stiles, Stuckey)

- Subject: `Your weekly Communications Center digest (1 update)`
- Idempotency key: `comms-digest:weekly:weekly:YYYY-Www:<agent_id>`

Rendered body (same for all 8, first name and "daily"/"weekly" swap):

```text
Hi <FirstName>,

Here is your daily Communications Center digest with 1 update matching your filters.

General Discussion (1)
--------------------------------
GENERAL DISCUSSION
Stager Needed
Aug 3, 1:48 PM ET

  Stager Needed
  From: Jarvid Cortes (Keller Williams Realty)
  Category: General Discussion

  Request Criteria
  State: MA

  Who is your go to South Shore home stager?

  Tahanks!
  Jarvid

Open Communications Center to view details and respond.
[Open Communications Center -> /communications/feed]
```

## Expected send time (if dispatch is repaired)

- Daily: the first run at or after 18:00 ET on the run day.
- Weekly: the first run at or after 18:00 ET on a **Friday** — the next one is Fri Aug 7. The two weekly items would sit until then.
- Separately, `COMMS_EMAILS_PAUSED = true` is still in effect, so even a created `email_jobs` row would not be delivered until that kill switch is lifted. Repairing dispatch alone does not release these emails.

## Observations for your decision

- The content is thin: a one-line question with no property type, price range, or town. Eight per-recipient emails whose sole content is "Who is your go to South Shore home stager?" may not be worth sending 4+ days late.
- By the time the weekly pair could go out (Aug 7), the item will be four days stale.

## Decisions requested (separately)

1. Release, discard, or leave the 8 pending items in place.
2. Approve or reject repairing the digest dispatch (the service-role GUC issue) as a separate change.

No action will be taken on either until you say so.
