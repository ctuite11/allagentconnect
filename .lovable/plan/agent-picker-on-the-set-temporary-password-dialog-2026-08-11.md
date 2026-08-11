# Agent picker on the Set Temporary Password dialog

Make the "Agent email" field on the admin Set Temporary Password dialog searchable against the admin agent list, so you can pick an agent instead of typing the address.

## Behavior

- The email field becomes a typeahead: typing filters agents by name or email and shows a dropdown of matches (name + email).
- Selecting a match fills the email field with that agent's address.
- Free typing still works — any address can be entered even if it isn't in the list (unchanged fallback).
- If the dialog is opened from a specific agent's row, that email is prefilled as it is today.
- The list is disabled once the password has been set (same as the current locked state).

## Technical notes

- `src/components/admin/SetTempPasswordDialog.tsx`: add an optional `agents` prop (id, email, first/last name). Replace the plain `Input` with an input plus a filtered suggestion list (shadcn `Command` inside a `Popover`, matching existing admin patterns), still writing to the same `email` state. No change to the `admin-set-user-password` call.
- `src/pages/AdminApprovals.tsx`: pass the already-loaded `agents` array into `SetTempPasswordDialog`. No extra fetch.
- No backend, RLS, or email changes.
