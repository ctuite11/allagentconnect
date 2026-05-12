# My Buyers shows 0 while Success Hub shows 1

## Root cause

Success Hub (`useSuccessHubData`) builds the buyer list as a **union** of two sources:
1. `client_agent_relationships` (status active/pending) for this agent
2. `hot_sheet_clients` rows on any of the agent's hot sheets

My Buyers (`src/pages/success-hub/BuyersList.tsx`) only queries source #1.

For agent `chris@allagentconnect.com`:
- Brody Tuite (`chris.tuite@compass.com`, client id `a8e3f4d2…`) is a member of 5 of the agent's hot sheets via `hot_sheet_clients` ✅
- There is **no row** in `client_agent_relationships` for brody under this agent (verified — 0 rows)

So Success Hub shows 1 buyer, My Buyers shows 0. The earlier orphan cleanup did not remove brody's relationship (none existed), but it exposed the inconsistency between the two views.

## Fix (two parts)

### 1. Data fix — restore the missing relationship

Insert one active row into `client_agent_relationships`:
- `agent_id` = `1fc50da1-2664-4931-8cab-64e24dc5ed8c`
- `crm_client_id` = `a8e3f4d2-da4e-4c64-9d1a-f9ff9764173e`
- `client_id` = same (no auth user yet — buyer hasn't claimed account; `client_id` may stay null if column allows)
- `status` = `active`

Done via the insert tool.

### 2. Code fix — My Buyers parity with Success Hub

Update `src/pages/success-hub/BuyersList.tsx` `loadBuyers()` to mirror Success Hub's union:

```text
1. Load active/pending client_agent_relationships for agent (existing query)
2. Load all hot_sheets where agent_id = me, then load hot_sheet_clients for those sheet ids
3. For each hot_sheet_clients row whose client_id is not already represented in step 1's result, add it as an "active" buyer row
4. Hydrate names/emails from clients table for the union
```

This ensures every buyer counted in Success Hub also appears in My Buyers, even if the relationship row is ever missing.

No DB schema changes. No other files touched.

## Files

- `src/pages/success-hub/BuyersList.tsx` — extend `loadBuyers()` with hot_sheet_clients union
- DB insert: 1 row into `client_agent_relationships`

## Verification

After applying:
- My Buyers page lists brody tuite (active)
- Success Hub still shows 1 buyer (no double counting — dedupe by client id)
