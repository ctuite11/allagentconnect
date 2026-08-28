# Create Agent: Run duplicate check on submit only (fastest path)

## Goal
Remove all background checking. The email/name lookup runs exactly once — when the admin clicks Review/submit for preview.

## Changes

### `src/components/admin/CreateAgentDialog.tsx`
- Remove the debounced email watcher / auto-check effect entirely (no lookup while typing).
- On the Review/Preview submit action:
  - Run `checkAgentEmail` once (normalized email + first/last name).
  - Show a brief inline "Checking…" state on the button while the call is in flight (single parallel call, ~200–400 ms).
  - If an active-account email match is found, keep existing blocking behavior and show the amber panel.
  - Name matches and other records remain amber warnings only.
  - If the check fails/times out, fail open (existing behavior) — server-side `admin-create-user` protections remain authoritative.
- No other UI changes; no changes to the deleted-agent flow.

## Out of scope
- No Edge Function changes (deployed `admin-check-agent-email` stays as-is).
- No schema changes, no emails/invitations sent during verification.

## Verification
- Typecheck + build pass.
- Confirm no network call fires while typing; exactly one call fires on Review submit.
