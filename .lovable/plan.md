# DCMLS V1 — Audit and Implementation Plan (nothing changed yet)

## What I found today (read-only)

- `listings.publish_to_dcmls` (required, default false) and `listings.dcmls_status` (required, default `not_published`, allowed: not_published / published / hidden / error). 110 listings, 0 published, 0 mismatches.
- There is **no** agent-level DCMLS participation field anywhere (agent settings or agent profile).
- Add Listing and Edit Listing both overwrite the DCMLS choice to OFF on every save (the temporary launch gate). Edit Listing already loads the stored DCMLS state into the form, so hydration works — only the save is forced off.
- DCMLS browse and the DCMLS homepage "exclusive listings" apply the DCMLS rule in **frontend code only**. The database does not enforce it.
- The public (signed-out) listing lookup returns any listing in a public status, ignoring DCMLS entirely.
- The public property page, when a user is signed in, reads the listing table directly; the signed-in rule permits any listing in a public status. **This is a real bypass:** a signed-in consumer with a link can open a listing that is not on DCMLS.
- Site-wide DCMLS mode can also be previewed on the main domain with `?dcmls=1`.

## A. Exact changes required for V1

**1. Agent opt-in (new, default OFF)**
- Add two fields to agent settings: participation flag (default false) and the date it was turned on. Nothing is backfilled, so all existing agents stay off.
- Add a single opt-in toggle in Agent Settings with a short explanation that opting in does not publish any listing.

**2. Listing opt-in stays separate**
- Keep the existing "Show this listing on DCMLS" checkbox, default off.
- The checkbox is disabled with an explanatory note when the agent has not opted in.

**3. Server-side enforcement (the core of V1)**
- A database rule (trigger) on listings: if the listing is marked for DCMLS but the owning agent has not opted in, the DCMLS fields are forced back to off/not_published on save. Agent opt-in alone never flips any listing on.
- A new server-side DCMLS view that returns a listing only when: agent opted in **and** marked for DCMLS **and** DCMLS status is published **and** the listing is in an allowed public status. DCMLS browse, the homepage exclusive section, and DCMLS saved/hot-sheet reads all switch to this view.
- A new single-listing lookup used by the DCMLS property page that applies the same four conditions and returns nothing otherwise.

**4. Save behavior**
- Remove the forced-off DCMLS snapshot from both Add Listing and Edit Listing saves; persist the agent's actual selection, and set the publish timestamp on first publish.
- Editing an already published listing keeps its DCMLS state unless the agent changes it.

**5. Direct access**
- On DCMLS (host or `?dcmls=1`), the property detail page loads through the gated single-listing lookup instead of reading the listing table directly, so a signed-in consumer cannot open a non-DCMLS listing on DCMLS.
- AAC's own behavior is unchanged: inside AAC, listings stay visible to agents and buyers exactly as today.

**6. Existing data**
- No backfill, no bulk update, nothing published. All 110 listings and all agents remain off.

**7/8. No emails, no redesign, no extra features** — nothing outside the above.

## B. Backend vs frontend

Backend (database migration only, additive):
- agent participation fields + defaults
- enforcement trigger on listings
- gated DCMLS listings view + grants
- gated single-listing lookup for the DCMLS detail page

Frontend:
- Agent Settings opt-in toggle
- DCMLS checkbox enable/disable + copy
- Remove the forced-off save gate in Add/Edit Listing
- Point DCMLS browse, exclusive listings, saved/hot-sheet, and the DCMLS property page at the gated sources

No new tables, no sync job, no duplicate listing storage, no edge functions.

## C. Paths that could expose a non-DCMLS listing publicly

1. **Signed-in direct URL to the property page** — confirmed bypass; fixed by the gated lookup (item 5).
2. **Shared-link public lookup** — returns any public-status listing regardless of DCMLS; on DCMLS it must use the gated lookup instead.
3. **Frontend-only DCMLS filtering** — any new query that forgets the filter leaks; fixed by moving the rule into the database view.
4. **`?dcmls=1` on the main domain** — lets anyone see DCMLS mode; harmless once the data rules are server-side, but worth confirming you want it kept.

## D. PR #71

I cannot read GitHub pull requests from here, so I could not verify it. Paste the PR title/description or its changed-file list and I will state exactly whether it overlaps items 1–5 before any code is written. If PR #71 touches the Add/Edit save gate or the DCMLS filter helper, it overlaps directly and one of the two should be dropped.

## E. Safest implementation order

1. Database: add agent participation fields (inert, default off).
2. Database: enforcement trigger + gated view + gated single-listing lookup (still inert — nothing is published).
3. Frontend: switch DCMLS browse / exclusive / saved / detail pages onto the gated sources. DCMLS still shows zero listings, which is correct.
4. Frontend: Agent Settings opt-in toggle.
5. Frontend: enable the listing checkbox and remove the forced-off save gate.
6. Controlled end-to-end test with one agent and one listing you nominate, then turn it back off.

Each step is reviewable on its own, and no listing can become public before step 5.

## Confirmations before build

- Should the agent opt-in also be visible to admins (read-only), or agent-only for V1?
- Keep or remove the `?dcmls=1` preview override?
- PR #71 details.
