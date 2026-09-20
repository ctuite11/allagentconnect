# DCMLS V1 — Backend only (approved scope)

Frontend is out of scope: PR #71 on `dcmls-v1-launch` already holds the DCMLS V1 frontend work and will be reconciled against this backend contract afterwards. Nothing here merges, deploys, publishes a listing, or sends email.

## Backend contract

A listing is visible on DCMLS only when **all** are true:
- the owning agent is currently opted into DCMLS
- the listing is marked for DCMLS
- the listing's DCMLS state is "published"
- the listing passes the existing allowed-status / non-deleted visibility rules

## What gets built (database only)

**1. Agent participation fields**
- Two new fields on agent settings: a participation flag (required, default off) and the date it was switched on.
- No backfill — every existing agent stays off.
- Admins can read participation; only the agent can change it (admin write is blocked).

**2. Server-side enforcement on save**
- A rule on the listings table: if a listing is marked for DCMLS while its agent is not opted in, the DCMLS fields are reset to off / not published on every insert and update.
- Turning agent participation on never touches any listing.

**3. Opt-out clears listing participation**
- A rule on agent settings: when participation flips from on to off, every listing owned by that agent is reset to off / not published in the same operation.
- Turning participation back on does not restore or republish anything — each listing must be re-selected by the agent.

**4. Gated DCMLS source**
- A new DCMLS-only listings view that joins participation and applies all four conditions. This is the single source for DCMLS browse, results, homepage exclusive listings, and saved/hot-sheet reads.

**5. Gated single-listing lookup**
- A new single-listing function for the DCMLS detail page that applies the identical four conditions and returns nothing otherwise, so a direct URL cannot bypass the rules.

**6. Grants and security**
- The gated view and lookup are readable by signed-out and signed-in visitors, and expose only the same marketing-safe columns the existing public listing path already exposes.
- No change to existing listings rules — AAC agent and buyer access is untouched.
- No new tables, no sync, no duplicate listing storage, no edge functions, no email behavior change.

**7. `?dcmls=1`**
- No backend behavior depends on it. DCMLS production identity stays domain-based; the preview override is a frontend concern handled in PR #71.

## Verification I will report afterwards

- The exact migration and the exact gating logic as written.
- Counts proving: agents opted in = 0, listings with DCMLS marked on = 0, listings in DCMLS published state = 0, all 110 listings unchanged.
- A read of the new gated view returning zero rows.
- A safe non-committed test showing that marking a listing for DCMLS without agent participation resets itself, and that opt-out clears a previously marked listing.

Then I stop — no frontend, no merge, no deploy, no test listing published.
