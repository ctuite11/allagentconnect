## Issue

Removing the buyer **n.lopachak@gmail.com** (Nataliia) from her Buyer Account fails with the generic "Couldn't remove this buyer client" toast.

## Root cause

The `agent_end_client_relationship(p_client_id)` Postgres function raises an exception when zero relationship rows are updated:

```sql
IF rows_affected = 0 THEN
  RAISE EXCEPTION 'No active or pending relationship found for agent % with identifier %.', auth.uid(), p_client_id;
END IF;
```

For this buyer the `client_agent_relationships` row is already `status = 'inactive'` with `ended_at` set (she was previously removed). The cascade-cleanup steps inside the function still run, but the trailing `UPDATE` matches nothing → exception → frontend shows the generic error.

There's no remaining active relationship, no hot-sheet membership, and no outstanding invite token, so once the function succeeds she'll drop out of My Buyers / Buyer Account naturally.

## Fix

Migration that replaces the body of `public.agent_end_client_relationship` to make it idempotent:

- Keep all existing cascade cleanup (hot sheets, sent listings, comments, listing status, notifications, favorites, hot_sheet_clients, share token revocation, relationship update).
- Remove the final `RAISE EXCEPTION` block.
- Always return `rows_affected` (0 when nothing was updated).

Result: clicking Remove on a buyer who is already detached succeeds, clears any leftover artifacts, and the UI shows the success toast and navigates away.

## Scope

- Single migration file `CREATE OR REPLACE FUNCTION public.agent_end_client_relationship(...)` — function body change only, signature unchanged.
- No frontend changes; `RemoveBuyerClientAction.tsx` already handles the rows-affected return and shows success.
- No schema, RLS, table, or other function changes.

## Out of scope

- Cleaning up the orphaned `share_tokens` whose `payload.client_id` points at deleted `clients` rows.
- Any change to BuyersList union logic — already correctly excludes inactive relationships.