# Hot Sheet Adoption: Diagnose and Nudge

## What the data shows (verified)

- 340 agent profiles; 347 verified, 243 activated, 108 seen in the last 14 days.
- Only 4 accounts have ever created a Hot Sheet (13 sheets total, 9 active). That is ~1.6% of activated agents.
- 31 CRM clients exist, 0 hot sheet subscribers, 0 saved searches.
- Nothing was deleted or hidden — sheets simply were never created.

This is an adoption problem, not a data or visibility bug.

## Goal

Find out where agents drop off when creating a Hot Sheet, and add low-risk in-app prompts that put the "Create Hot Sheet" action in front of activated agents who have none. No emails are sent as part of this work.

## Phase 1 — Diagnose the create flow (read-only)

Walk the flow the way an agent experiences it, in the browser against the running app:

1. Sidebar "Hot Sheets" -> `/agent/hot-sheets` -> "Create Hot Sheet" dialog -> save.
2. Record every required field, validation block, and error in the dialog.
3. Check the same path from the Success Hub buyer/client surfaces (creating a sheet attached to a buyer).
4. Confirm the dashboard "My Hot Sheets" tile and empty states are reachable and correct.

Deliverable: a short written findings list — each friction point, whether it blocks or just discourages, and the fix size.

## Phase 2 — In-app nudges (frontend only)

Based on Phase 1 findings, add prompts using the existing canonical components and brand tokens. No redesigns:

- Agent dashboard: when the agent has zero Hot Sheets, turn the "My Hot Sheets" tile into an actionable prompt that opens the create dialog directly instead of only navigating.
- Hot Sheets page empty state: make the existing "No Hot Sheets yet" copy include a primary button that opens the create dialog, rather than pointing at a button elsewhere on the page.
- Buyer/client surfaces: where a client has no Hot Sheet, surface a single "Create Hot Sheet for this buyer" action inline.

Each nudge is dismissible-free and purely additive — no changes to matcher, email, or queue logic.

## Phase 3 — Fix confirmed friction

Only the items Phase 1 proves are blocking. Scoped and listed for your approval before implementation if any of them touch validation or data.

## Explicitly out of scope

- No emails, campaigns, broadcasts, re-enqueues, or queue changes of any kind.
- No changes to the Hot Sheet matcher, delivery code, or crons.
- No changes to existing Hot Sheet rows or `hot_sheet_sent_listings`.
- No UI redesigns beyond adding the prompts described above.

## Technical notes

- Files in play: `src/pages/HotSheets.tsx` (empty states, `CreateHotSheetDialog` trigger), `src/pages/AgentDashboard.tsx` (the "My Hot Sheets" tile at the count card), `src/pages/success-hub/BuyersList.tsx` and `src/pages/success-hub/BuyerAccount.tsx` (per-buyer prompt), `src/components/CreateHotSheetDialog.tsx`.
- Phase 1 uses Playwright against localhost with an existing session; strictly read-only, no writes to the database.
- All styling uses existing AAC tokens (Primary Blue, Success Emerald) and canonical components — no raw Tailwind color utilities.
