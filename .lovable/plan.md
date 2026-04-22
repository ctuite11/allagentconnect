

## Goal
Make "Remove Buyer" a clean wipe of buyer-workflow state for THIS agent, while preserving the CRM contact in Contacts so you can reconnect later. Also clarify the cross-agent question.

## Important clarification (cross-agent isolation)
The `clients` table is **per-agent**: each agent has their own `clients` row for the same person (keyed by `agent_id` + `lower(email)`). So another agent adding "chris.tuite@compass.com" was never blocked by your row — they get their own. The duplicate error you hit earlier was because YOUR own prior `clients` row still existed. Removing buyers does NOT affect any other agent's ability to add the same person.

## What "Remove Buyer" will do (new behavior)

For the targeted CRM contact (`p_client_id`) belonging to the calling agent:

1. End the relationship in `client_agent_relationships` (status=`inactive`, `ended_at=now()`) — covers both `client_id` (auth user) and `crm_client_id` (CRM row) matches. *(already happening)*
2. **Delete this agent's hot sheets for that buyer** — `DELETE FROM hot_sheets WHERE user_id = auth.uid() AND client_id = p_client_id`.
3. **Delete hot sheet membership rows** — `DELETE FROM hot_sheet_clients WHERE client_id = p_client_id` for hot sheets owned by this agent (join-scoped).
4. Cascade-clean dependent rows on those hot sheets (`hot_sheet_sent_listings`, `hot_sheet_comments`, `hot_sheet_listing_status`, `hot_sheet_notifications`, `hot_sheet_favorites`) scoped to the deleted hot sheet IDs.
5. **Keep the `clients` row** — buyer remains in Contacts with full history (name, email, phone, notes).

Net result: My Buyers no longer shows them, your hot sheets/comments tied to them are gone, the CRM contact stays editable in Contacts, and re-adding them as a buyer later just re-activates the relationship via the existing `activate_agent_relationship` / "Add to Buyers" flow.

## Implementation

### A. New migration — replace `agent_end_client_relationship`
Rewrite the function to perform the cascading wipe in one transaction, scoped strictly to `auth.uid()`:

```text
- resolve hot_sheet_ids owned by auth.uid() with client_id = p_client_id
- delete dependents (sent_listings, comments, listing_status, notifications, favorites) where hot_sheet_id IN (...)
- delete hot_sheet_clients where hot_sheet_id IN (...)
- delete hot_sheets where id IN (...)
- update client_agent_relationships -> inactive (existing behavior)
- return rows_affected for the relationship update
- DO NOT touch public.clients
```

Keep `SECURITY DEFINER`, `search_path=public`, and the existing "no active/pending relationship" guard.

### B. Frontend — no behavior change required
`RemoveBuyerClientAction.tsx` already calls `agent_end_client_relationship`. Toast copy updated to: *"Buyer removed. Hot sheets and history cleared. They're still in Contacts."*

### C. Add Buyer re-flow safety net
Already shipped: `CreateBuyerDialog` catches `23505` and tells you the contact exists. After this change you can either:
- Use the existing contact via the "Add to Buyers" action in Contacts (preferred), or
- Delete the contact in Contacts first if you want a fresh row.

No further change needed there.

## Files changed
- `supabase/migrations/<timestamp>_rewrite_agent_end_client_relationship_cascade.sql` (new)
- `src/components/success-hub/RemoveBuyerClientAction.tsx` (toast copy only)

## Verification after merge
1. Pick a test buyer with hot sheets. Confirm counts in `hot_sheets`, `hot_sheet_clients`, `client_agent_relationships` for that `crm_client_id`.
2. Click Remove Buyer.
3. Re-query: hot sheets = 0, hot_sheet_clients = 0, relationship = inactive, `clients` row still present.
4. Open Contacts → buyer is there. Click "Add to Buyers" → relationship re-activates without 23505 error.

