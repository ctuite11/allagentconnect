## Plan — `src/components/hot-sheets/DuplicateContactDialog.tsx` only

Today the primary CTA is always **"Send this hotsheet with invite"**. That copy is only correct when the buyer has never accepted an invite from this agent. If they already accepted (i.e., the buyer has a live, accepted client↔agent relationship with the sending agent), no new invite is being sent — they're just being attached to the hot sheet.

### Detection rule

The contact is considered "already accepted" if `client_agent_relationships` has a row matching all of:
- `agent_id` = current user
- `crm_client_id` = `existingClient.id`
- `status = 'active'`
- `client_id IS NOT NULL` (means the buyer signed up + accepted, not just a pending CRM-only row)

### Behavior

1. When the dialog opens with an `existingClient`, run a single lightweight query for that row (`select id` + `.maybeSingle()`), guarded by a loading flag. Re-query whenever `existingClient.id` changes.
2. While loading, disable the primary CTA and show "Checking…".
3. After load:
   - **Already accepted →** CTA label: `Add to this hotsheet`. In-progress label: `Adding…`.
   - **Not accepted (default) →** CTA label: `Send this hotsheet with invite`. In-progress label: `Sending…`.
4. No change to `onAddToSheet` behavior — the parent already handles attach + invite logic. This is label-only.
5. On query error, fall back to the invite copy (safer default) and log to `console.warn`.

Scope is strictly this one component; no schema, RPC, or parent-component changes.