# Chris-only Communications correction — approval proposal

Status: preparation only. No runtime code, preferences, database records, queues, deployed functions or templates changed. No hosted send/dry-run functions invoked. Local prototype is in `comms-chris-only-proposal.test.ts`, never imported by production.

## Proposed correction

Keep the shared matcher and all existing broadcast event evaluations unchanged. In the core Communications broadcaster only, supplement a failed match for Chris with one narrow Boston/MA/Suffolk event:

- Require both recipient UUID `1fc50da1-2664-4931-8cab-64e24dc5ed8c` and normalized email `chris@allagentconnect.com` from the server-loaded audience. Neither value is client-selectable.
- Require a currently saved Boston/Suffolk/MA notifications row and a post explicitly including Boston and MA.
- Resolve the fixed Boston → Suffolk association independently from the saved preferences (confirmed by the project's MA county reference). Do not infer other towns' counties.
- Read counties from the original parsed post criteria, before split-event expansion. If no county is supplied, the independently established Boston/Suffolk association may supply Suffolk. If counties are supplied, require only Suffolk; unknown/conflicting or mixed counties get no supplemental match. Do not guess county slug/name equivalence in this first correction.
- Evaluate that complete event using the unchanged shared matcher and Chris's original price/type/geographic restrictions. Other saved town rows, ZIPs and neighborhoods receive no relaxation.
- Existing network-wide and no-criteria behavior remains unchanged. This is not a statewide-post or rental-price workaround.

The Oct 20 real post explicitly has MA, Boston/Newton, $2M–$2.5M and single-family/condo, but no counties. This proposal can recover Chris's Boston branch, not Newton or another agent's matching.

## Isolation and delivery parity

All other UUID/email pairs return the original decision. Audience, hidden-account opt-in, both master switches, category gates, sender exclusion, cadence/mute checks, pauses, deduplication, queue creation, reminders, sender-copy handling and templates stay unchanged. No second send pass or historical recipient augmentation.

Only `send-client-need-notification` would change after approval. Shared matcher, seller/legacy alerts, digest processing, resends, and queue workers remain unchanged. Digests consume already-selected items; resends retain original recipients. No replay/backfill is authorized.

Prepared local checks: 16 proposal checks passed, including missing county, explicit Suffolk, Norfolk conflict, mixed counties, wrong/missing state, wrong town, price/type restrictions, ZIP/neighborhood requirements, exact UUID/email isolation, and statewide exclusions. Twenty other-account preference/post fixture combinations retain identical decisions. All 11 existing matcher assertions passed via a local Bun assertion shim. These are proposal-level checks, not a deployed integration or exhaustive live-audience certification.

## Current account recheck (read-only)

Chris remains verified, activated, hidden with explicit Comms hidden opt-in, unmuted, immediate cadence; all four channels and both master switches are true. Saved area remains Boston/Suffolk/MA; $1M minimum, no maximum, all eight types. No unsubscribe row. `public.suppressed_emails` remains absent despite the audience helper referencing it; therefore a clean suppression result is not certified. The database job block function only blocks retired listing-alert jobs, not Communications.

Do not fix that shared suppression discrepancy as part of this isolated proposal: first reconcile actual delivery-time/provider suppression read-only for Chris. If unresolved or requiring broader changes, stop and report separately rather than bypassing suppression or changing other-agent behavior.

## Before and after deployment approval

1. Obtain approval for this specific isolated implementation/deployment. Implement a pure adapter restricted as above, optionally with a server-side enable switch defaulting off; never a request-supplied override.
2. Run complete mocked broadcaster comparisons, including immediate/digest rosters, reminder and self-copy payloads and every existing non-Chris recipient. Assert identical non-Chris recipients, reasons, cadence and job payloads. All changed eligibility must be Chris only. Use read-only snapshots of real posts/current audience locally, not live send calls.
3. Reconcile Chris-only suppression and active pause state without changes. Stop on unresolved blockers. Report integration results; do not deploy a failing correction.
4. After authorized deployment, run read-only/local eligibility checks against current data. Never invoke a live broadcast to test fan-out.
5. Prefer a genuinely new qualifying Communications post. Verify Chris's one job, correct destination, queue outcome and provider-delivered event, and ask Chris to confirm receipt. Existing normal recipients of that real post remain governed by unchanged behavior; the correction must add no other recipient.
6. A controlled test is optional, not part of this preparation. If necessary, present the exact one-email action first; use a path enforcing one sole destination (Chris), no CC/BCC or sender copies, no network audience traversal, no other jobs and a unique test deduplication key. Do not use the multi-agent broadcaster for a test send. A provider test alone does not prove normal future matching.

No old emails are resent or backfilled. Verification remains pending approval, integration checks, and actual delivery evidence.