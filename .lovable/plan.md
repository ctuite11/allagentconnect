# Last two listings: no Hot Sheet expected

## What the data shows

Both of the most recent listings are still unpublished drafts, so no Hot Sheet alert was generated or sent. That is correct behavior — alerts only fire on a publish transition (`coming_soon` / `active`).

| Listing | Created (UTC) | Status | Notes |
|---|---|---|---|
| 106 Harrishof St. | Aug 15, 19:19 | draft | city "TBD", zip 00000, price 0, no beds/baths, 0 photos |
| 6 Judson Street, Beverly MA | Aug 15, 18:13 | draft | 2bd/1ba, $2,200 rental, 0 photos |

Last actual Hot Sheet delivery: **Aug 14, 01:23 UTC** — 23 Burnham Street, Somerville, to your Boston hot sheet. Today's email traffic was Communications Center only (daily digest + Attleboro discussion thread), no hot sheet stream jobs.

## Recommendation

No code change is required. The two drafts are simply incomplete — 106 Harrishof is missing address/price/bed/bath data, and both have zero photos — so neither can publish.

## Optional follow-up (not started)

If you want, a small non-invasive addition: a "Draft — not live, no alerts sent" reminder on the My Listings pipeline card, so agents can see at a glance that a draft isn't reaching anyone. Frontend-only, no email or backend changes.
