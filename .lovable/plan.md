Plan: Apply buyer hot sheet RLS fix and verify end-to-end

Implementation

1. Add database/RLS migration
- Create a new migration that updates `public.hot_sheet_clients` access.
- Drop the existing email-matching policy:
  - `Clients can view their hot sheet links`
- Replace it with relationship-based access so buyers can read their hot sheet link rows without relying on `clients.email = profiles.email`.

2. Use authenticated relationship linkage
- Add a `SECURITY DEFINER` helper function, if needed, to safely check whether the signed-in buyer is linked to the CRM client record used by `hot_sheet_clients`.
- The access check will allow SELECT when:
  - `client_agent_relationships.client_id = auth.uid()`
  - `client_agent_relationships.crm_client_id = hot_sheet_clients.client_id`
  - `client_agent_relationships.agent_id = hot_sheets.user_id`
  - relationship is active and not ended
- Keep the existing agent-owned hot sheet client access policy unchanged.

3. Do not change unrelated behavior
- No frontend route changes.
- No database table shape changes beyond policy/function migration.
- No changes to favorites, cards, listings, map, or hot sheet creation UI.
- No reliance on email matching for this buyer access path.

Verification after migration

1. Create a buyer hot sheet from the buyer flow.
2. Confirm creation succeeds.
3. Confirm navigation opens `/client/hot-sheets/:id` successfully.
4. Confirm the Hot Sheets count changes from `0` to the expected count.
5. Refresh the page and confirm the created hot sheet still appears.

Expected result
- Buyer-created hot sheets immediately appear in the buyer Hot Sheets list.
- Direct detail navigation works for `/client/hot-sheets/:id`.
- Refresh persistence works because access is based on authenticated buyer relationship linkage, not email matching.