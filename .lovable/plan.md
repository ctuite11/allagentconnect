## Fix Add Contact "Failed to save client" error

The red toast is a catch-all that hides the real database error. Looking at `MyClients.tsx` insert (line 229) vs the working `CreateBuyerDialog` insert, the contact insert is missing `agent_user_id`, which is likely required by the `clients` table (or by an RLS policy). That's almost certainly what's failing — and it fails on desktop too, but it's more visible on mobile because that's where you tested.

## Changes

**`src/pages/MyClients.tsx` — `handleSubmit`**

1. Include `agent_user_id: user.id` in the insert payload (matching the pattern used by `CreateBuyerDialog`).
2. Replace the generic `toast.error("Failed to save client")` with the actual error message: `toast.error(error?.message || "Failed to save client")`, and log the full error (`message`, `code`, `details`, `hint`) to the console for future debugging.

No DB schema, RLS, or UI changes. Strictly the insert payload + error surfacing.

## Verification

- Open Add Contact on mobile, submit a new contact → should succeed.
- If it still fails, the toast will now show the real Postgres error so we can fix the next layer (e.g. missing column, RLS policy) precisely.
