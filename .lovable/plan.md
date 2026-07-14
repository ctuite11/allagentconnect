## Corrections to Communications Center category flags

Follows the audit conclusion: the four category booleans (`buyer_need`, `renter_need`, `sales_intel`, `general_discussion`) can't be trusted as opt-outs today because the DB default is `false` and most rows land there without any user action.

Note vs earlier claim: `NotificationPreferenceCards` (rendered on `/communications-center`) does have working toggles that write these flags via upsert AND set `agent_settings.preferences_set=true`. So the UI exists — but agents who never visited that section have their row created by the price/property-type/geo save paths, which don't touch the four booleans, leaving them at the DB default `false`. Those are the 32 default-artifact rows.

### 1. Stop treating the four category flags as opt-outs (edge functions)

`supabase/functions/send-client-need-notification/index.ts` — remove the `optedOut` set built from `notification_preferences.<category> = false`. Pass `undefined` for the opt-out set to `partitionAudience`. `category_opted_out` count reports 0. No other function reads these flags, so no other edge changes needed.

Do not special-case Betsy. Do not infer opt-out from any combination of existing flag values.

Global unsubscribe / suppression and sender self-exclusion remain authoritative (unchanged).

### 2. Migration — flip defaults and backfill

Single migration:

- `ALTER COLUMN buyer_need SET DEFAULT true` (same for `renter_need`, `sales_intel`, `general_discussion`).
- Backfill: `UPDATE notification_preferences SET buyer_need=true, renter_need=true, sales_intel=true, general_discussion=true` — set all four to `true` for every existing row, unconditional. Per your instruction, do not preserve any existing `false` value including Betsy's, because no auditable UI path proves the value was deliberate.

No schema changes beyond defaults. No NOT NULL change. No trigger changes. Columns remain non-nullable.

### 3. UI — category controls stay, defaults display as ON

`src/components/NotificationPreferenceCards.tsx` already renders four Switch toggles wired to the four flags and calls `agent_settings.preferences_set=true` on toggle. Concrete changes:

- Initial state constant: default local state to `{buyer_need:true, sales_intel:true, renter_need:true, general_discussion:true}` (currently `false`), so the pre-fetch skeleton and any missing-row case render as ON — consistent with the new DB default.
- In `fetchPreferences`, treat a missing row (`PGRST116`) as all-four-ON.
- Copy above the four cards: one short line clarifying "Choose which network activity you want to receive. Which opportunities inside each category you get is controlled separately by your targeting preferences below." (Keep tone consistent with the existing `CommunicationsDefaultsNotice`.)

`src/lib/ensureDefaultCommsChannels.ts` — the "flip channels ON when all four are false" backfill helper is now redundant once defaults change and the backfill runs, but keep the file as a no-op safety net for the AgentAccountSetup flow (early return when the row is missing since default insert now yields ON). No behavior change needed beyond a comment note.

### 4. Targeting stays independent

No change — the shared matcher already treats price / property type / location as independent AND-ed dimensions with blank = no restriction. Categories are unrelated: a user turning off `renter_need` in the UI now yields `renter_need=false` (a real opt-out), while `buyer_need` broadcasts still go through and respect the targeting dimensions.

### 5. Dry-run verification (queue stays paused)

After deploy + migration:

- Re-run the projection script from the last audit against Frank / Anthony / Chris.
- Expected outcome: `category_opted_out` drops to 0 across all three; recipient counts should return to roughly the 60-recipient range projected earlier (matched + unset fallback, minus sender + globally suppressed).
- Report the per-broadcast breakdown (audience, profile complete, sender excluded, globally suppressed, category opt-out, preferences matched, preferences-unset fallback, non-matching, already received, final new).
- No live send, no unpause, no backfill of Frank's broadcast until you approve.

### Files touched

- `supabase/migrations/<new>.sql` — defaults + backfill
- `supabase/functions/send-client-need-notification/index.ts` — remove category opt-out lookup
- `src/components/NotificationPreferenceCards.tsx` — default local state ON, missing-row = ON, add clarifying copy
- `src/lib/ensureDefaultCommsChannels.ts` — comment update only
- `.lovable/plan.md`

### Out of scope

- No changes to targeting dimensions, hot-sheet path, or `notify-agents` / `send-seller-alert` (those don't read the four category flags).
- No changes to the Missing Opportunities reminder cadence or its 30-day gate.
- No schema changes beyond defaults; no NOT NULL / nullability changes.
- No live sends and no resend of Frank's broadcast.
