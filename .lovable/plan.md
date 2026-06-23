## Bring Supabase + frontend fully in sync with the hot sheet invite fix

### 1. Database migration (missing)
Add `supabase/migrations/20260525120000_hot_sheet_clients_buyer_email_select.sql`:
- Update `can_authenticated_buyer_view_hot_sheet_client(p_hot_sheet_id, p_crm_client_id)` so it also returns true when the caller's `profiles.email` (lowercased, trimmed) matches the `clients.email` for that `crm_client_id` on a hot sheet owned by an agent the buyer has any (active or accepted) link to.
- Security definer, `search_path = public`, no schema change — function body only.
- No GRANTs needed (function replacement).
- Verify with `select can_authenticated_buyer_view_hot_sheet_client(...)` against a known accepted invite.

### 2. New shared lib files
- `src/lib/loadBuyerHotSheetAccess.ts` — collects hot sheet IDs via `hot_sheet_clients` SELECT + `list_my_accepted_hot_sheet_tokens` RPC, then hydrates rows via `list_hot_sheets_for_member` RPC. Returns `{ ids, rows }`.
- `src/lib/inviteAcceptanceHandoff.ts` — sessionStorage helpers: `setAcceptedHotSheetId`, `consumeAcceptedHotSheetId`, `peekAcceptedHotSheetId`.

### 3. Wire the loader in
- `src/pages/HotSheets.tsx` — replace direct `share_tokens` / `hot_sheets` queries in the buyer path with `loadBuyerHotSheetAccess`. Keep agent-mode queries unchanged.
- `src/pages/ClientDashboard.tsx` — already calls the RPCs; add the handoff seed + retry (up to 2 retries) when `peekAcceptedHotSheetId()` is set but the loaded list doesn't yet contain it. Clear the handoff once present.
- `src/lib/acceptClientHotSheetInvite.ts` (or the invite acceptance UI path) — call `setAcceptedHotSheetId(hotSheetId)` on success before navigating to the dashboard.

### 4. Buyer green branding on the pre-signup modal
- `ClientHotsheetPage`: replace the blue primary modal with the green `BuyerShell`-style header ("Buyer Portal", AAC monogram, emerald CTA). Route "Set Up My Account" to `/invite/:token` (drops the `/client-invite?...` path).
- Apply the same navigation change to legacy `ClientHotSheet.tsx`.
- No new color literals — use the existing emerald tokens from `src/lib/brandColors.ts` / `BuyerShell`.

### 5. Deploy + verify
1. Run the migration via the migration tool (approval required).
2. Redeploy `accept-client-hot-sheet-invite` (source already has the email→CRM resolve path, just re-push to be safe).
3. Manual test from a fresh invite:
   - Pre-signup modal is green-branded.
   - "Set Up My Account" → `/invite/:token`.
   - After accept → dashboard shows the hot sheet immediately (handoff path).
   - Hot Sheets tab shows the same sheet.
   - Refresh → still visible (RLS + RPC path).
4. Spot-check: signed in as the new buyer, run `select * from hot_sheet_clients where hot_sheet_id = '<id>'` — should return the row via the updated policy.

### Out of scope
- No changes to agent-side hot sheet UI, CTA labels, or zero-selection dialog (separate tracks).
- No changes to email template copy (already verified earlier).
- No schema column changes — function replacement only.