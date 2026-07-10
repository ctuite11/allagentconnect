## Problem

On mobile the top of each My Listings card is unreadable:
- 10 action items (Edit • Photos • Open House • Broker Tour • Matches • Email • Social • 👁 12 • ♥ 0 • Stats) wrap onto 3 lines.
- The absolutely-positioned right block (status pill + AAC List Date + Exp) overlaps the wrapped action row.
- Result: text collides ("Matches(5) ist DatE:mail 7/1/2026").

Desktop layout is fine — cleanup is mobile-only (< `sm` / 640px).

## Rule

On mobile, show only what an agent actually needs at a glance on the card header. Everything else moves into an existing overflow ("More") menu that already exists at the bottom of the card row.

## Mobile action row (< sm) — kept

1. **Edit**
2. **Photos**
3. **Matches (n)**
4. 👁 views • ♥ favorites (as a compact pair)

## Mobile — hidden (still visible on `sm+`, still available on mobile via the existing "⋯ More" dropdown)

- Open House
- Broker Tour
- Email
- Social
- Stats

These get `hidden sm:inline-flex` (and their neighboring `•` separators get `hidden sm:inline`). No behavior removed — the "More" menu near the Quick Edit / bottom of the card already exposes Edit / Broker Tour / Open House etc.; we extend it on mobile to also include Email, Social, and Stats so nothing is lost.

## Right-side status block

Currently `absolute right-4 top-4` — this is what overlaps the wrapped row. Change:

- On mobile: drop the absolute positioning. Render the status pill inline at the top-right of the header flex row (status badge only). Move **AAC List Date** and **Exp** underneath the address in the card body, as a single line: `Listed 7/1/2026 · Exp 10/30/2026`.
- On `sm+`: keep today's absolute right-aligned stack unchanged.

## Files

- `src/pages/MyListings.tsx` — the card block starting at line 747. Add responsive classes; no logic changes; no props changes; no other files touched.

## Verification

At 384px width (user's viewport):
- Header row fits on one line: Edit • Photos • Matches (n) • 👁 12 • ♥ 0 + status pill right-aligned.
- No overlap between status/date block and actions.
- Tapping "⋯" reveals Open House, Broker Tour, Email, Social, Stats.
- At ≥ 640px the card looks exactly as it does today.
