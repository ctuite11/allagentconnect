# Create Agent — remove redundant email re-check on review step

## Goal

The duplicate/existing-agent email lookup already runs (debounced) as soon as a valid email is typed on the form step. Re-running it when entering the Confirm/Review step adds a network call and delay for no benefit. Remove the second check.

## Change

**`src/components/admin/CreateAgentDialog.tsx`**

1. In `handleReview`, delete the `void runCheckNow();` call (and its comment). Entering the confirm step just uses the `emailCheck` result already gathered by the debounced lookup.
2. Remove the now-unused `runCheckNow` function (lines ~73-83) if nothing else references it.
3. Confirm-step rendering of the check result panel stays as-is — it displays whatever the debounced lookup found (including "No existing record").

## Safety

- The debounced lookup still runs on every valid email entry, so the confirm step always reflects the current email (the effect re-fires if the email changes).
- `admin-create-user` server-side 409 protections (already-registered, previously-deleted) remain the authoritative gate — unchanged.
- The previously-deleted-agent pre-check in `handleConfirmSend` is unchanged.

## Out of scope

- No Edge Function, email, template, or schema changes.
- No emails sent during verification.

## Verification

- Typecheck + build pass.
- Manual: enter a valid email → debounced panel appears → Review → confirm step shows the same result instantly with no extra lookup/delay.
