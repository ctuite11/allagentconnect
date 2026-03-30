
# Buyer Visibility + Manual Creation (Completed)

## Changes Made

1. **BuyersList.tsx** — Replaced mock data with real DB queries (client_agent_relationships → clients + hot_sheet_clients count). Added "New Buyer" CTA.
2. **BuyerAccount.tsx** — Replaced mock data with real DB queries (clients + hot_sheet_clients → hot_sheets).
3. **CreateBuyerDialog.tsx** — New component for manual buyer creation (inserts into clients + client_agent_relationships).
4. **SaveToHotSheetDialog.tsx** — After client association, upserts client_agent_relationships row if missing.
5. **CreateHotSheetDialog.tsx** — Same relationship upsert in both create and edit paths.
