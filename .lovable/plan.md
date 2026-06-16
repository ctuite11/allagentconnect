## Goal

On the buyer side of Share Listing (when `senderProfileSource="buyer"`), remove the "Search Contact" field entirely. Buyers add recipients via manual entry only.

The agent-side flow is untouched.

## Change

`src/components/share/ShareListingsDialog.tsx`
- Add a new optional prop `hideContactSearch?: boolean`.
- When `hideContactSearch` is true:
  - Do not render the SEARCH CONTACT label, input, or dropdown.
  - Default `manualMode` UI to visible (skip the "+ Enter recipient manually" toggle — manual entry fields are the only path).
  - Keep the selected-recipient chip + remove behavior.

`src/components/ShareListingDialog.tsx`
- Pass `hideContactSearch={senderProfileSource === "buyer"}` to `ShareListingsDialog`.
- Skip mounting `useAgentShareContactSearch` for buyers (already gated by `contactsEnabled`; no functional change).

## Out of scope

- No changes to agent share flow, copy, styling, send logic, or success toasts.
- No DB or edge function changes.
