
# Independent-dimension Comms Center matching (shared across all preference-targeted paths)

## Audit result (already run, no code touched)

Frank's Marina Bay broadcast `a9f202f2-6511-44c9-b74a-24fb23b8ed61` (state=MA, city=Quincy, type=condo, $700K–$1M) under independent-dimension rules:

- Eligible after sender + opt-out + suppression exclusions: **62**
- Any dimension configured: 17 → **16 match**, **1 non-match** (Patrick Bateson, types=[single_family])
- No dimensions configured (unset fallback): **45**
- **Total would-receive: 61**

This replaces the old 22-recipient outcome.

## Rule (approved)

For each profile-complete + has-email agent, after excluding sender / category opt-out / globally suppressed:

- **Location** (only `agent_buyer_coverage_areas.source='notifications'`): if 0 rows → auto-pass. Otherwise OR across saved rows; each row is a match when every populated field on the row matches the event on that field. Supported fields: `state`, `county`, `city`, `zip_code`, `neighborhood`. Case- and whitespace-normalized. ZIP sentinels `00000`/`00001` ignored. Empty fields on a saved row do not constrain that dimension.
- **Price**: if `min_price` NULL → no lower bound; if `max_price` NULL → no upper bound; `has_no_min`/`has_no_max=true` also mean no bound on that side and never restrict. If event supplies a range `[eventMin, eventMax]`, use range intersection with `[savedMin ?? -∞, savedMax ?? +∞]`; if event supplies a single price, treat as a point.
- **Property type**: if `property_types` empty → auto-pass; otherwise require normalized intersection with the event's `propertyTypes`.
- Configured dimensions AND together. All-blank → preferences-unset fallback (still receives).

## Shared matcher

New file `supabase/functions/_shared/communicationPreferencesMatcher.ts` exporting:

```ts
export interface SavedGeoRow {
  state?: string | null; county?: string | null; city?: string | null;
  zip_code?: string | null; neighborhood?: string | null;
}
export interface AgentPreferences {
  geoRows: SavedGeoRow[];              // only source='notifications'
  minPrice: number | null;
  maxPrice: number | null;
  hasNoMin: boolean;
  hasNoMax: boolean;
  propertyTypes: string[];             // normalized lowercase snake_case
}
export interface PreferenceEvent {
  state?: string | null; county?: string | null; city?: string | null;
  zip?: string | null; neighborhood?: string | null;
  price?: number | null;               // point value
  minPrice?: number | null; maxPrice?: number | null;   // range form
  propertyTypes?: string[] | null;     // event may carry >1 for broadcasts
}
export interface MatchResult {
  matches: boolean;
  anyDimensionConfigured: boolean;
  failedDimension?: "location" | "price" | "property_type";
  perDimension: { location: boolean; price: boolean; property_type: boolean };
}
export function matchesCommunicationPreferences(
  agent: AgentPreferences,
  event: PreferenceEvent,
): MatchResult;
```

Contract:
- `location`: no `geoRows` → true. Otherwise true iff ≥1 row where every non-empty field on the row equals the corresponding event field (normalized). ZIP `00000`/`00001` treated as unpopulated.
- `price`: build saved band `[minPrice ?? -∞, maxPrice ?? +∞]`; build event band from `price` (as point) or `minPrice`/`maxPrice`. True iff bands intersect. `hasNoMin`/`hasNoMax` do not add restriction.
- `property_type`: empty saved → true. Otherwise true iff `savedTypes ∩ eventTypes ≠ ∅`. Normalize both sides.

Unit-test the matcher (Deno test in `supabase/functions/_shared/`) with the six canonical cases from the spec (no-town, price-only, type-only, geo+price, all three, none) plus ZIP sentinels and case-insensitive location match.

## `verifiedAgentAudience.ts` changes

Extend `EligibleAgent` with the raw saved dimensions, drop the current preferences_set boolean as a gate (keep it as a computed convenience):

```ts
interface EligibleAgent {
  // …existing fields
  savedPrefs: AgentPreferences;
  preferences_set: boolean; // derived: any dimension configured
}
```

Populate `savedPrefs.geoRows` from `agent_buyer_coverage_areas` where `source='notifications'` (all five geo columns). Populate price + types from `notification_preferences`.

`partitionAudience` signature is unchanged; it continues to own profile-complete vs reminder, sender exclusion, category opt-out, and preferences-match vs preferences-unset reason. It calls the injected `matches` callback exactly as today — callers supply `(agent) => matchesCommunicationPreferences(agent.savedPrefs, event).matches`. Counter labels stay the same.

## Edge function callers to update (all use the shared matcher)

1. `supabase/functions/notify-agents-client-need/index.ts` — event `{state, city, propertyTypes:[propertyType], price: maxPrice}` (or minPrice/maxPrice if the client_need grows a range later). Remove the current `agent_state_preferences` intersect.
2. `supabase/functions/notify-agents-new-listing/index.ts` — event from listing `{state, county, city, zip, neighborhood, propertyTypes:[listing.property_type], price: listing.price}`.
3. `supabase/functions/notify-agents/index.ts` — generic broadcast dispatcher; pass through the criteria payload (this is the path Frank's broadcast used).
4. `supabase/functions/send-client-need-notification/index.ts` — same event shape as (1).
5. `supabase/functions/send-seller-alert/index.ts` — event `{state, county, city, zip, neighborhood, propertyTypes, price}` from the seller alert row.

Each caller: fetch audience via `getVerifiedAgentAudienceWithStats`, build the event object, call `partitionAudience(audience, a => matchesCommunicationPreferences(a.savedPrefs, event).matches, senderId, optedOut)`, keep existing dedup + email-jobs enqueue logic.

## Not touched

- Hot-sheet listing notification path (`hot_sheet_*`) — separate matching semantics, out of scope.
- UI in `ClientNeedsDashboard.tsx` / Comms Center preferences editor — no changes.
- Database schema — no migrations.
- `checkAgentCommunicationPreferencesSet` client helper — no changes.

## Verification sequence (queue stays paused)

1. Deploy code.
2. `dry_run: true` on the three most recent buyer-need broadcasts (Frank's Marina Bay, Anthony Maiullari's Cambridge/Somerville $425k, Chris Tuite's MA-only). Confirm counts match the audit table above (Frank → 61) before any live send.
3. Post `dry_run` output to chat for approval.
4. Only then unpause and allow the next Comms Center send. No backfill / resend of Frank's broadcast unless explicitly requested — the 22 who already received it are recorded in `comms_broadcasts` history.

## Files touched

- `supabase/functions/_shared/communicationPreferencesMatcher.ts` (new)
- `supabase/functions/_shared/communicationPreferencesMatcher.test.ts` (new)
- `supabase/functions/_shared/verifiedAgentAudience.ts`
- `supabase/functions/notify-agents-client-need/index.ts`
- `supabase/functions/notify-agents-new-listing/index.ts`
- `supabase/functions/notify-agents/index.ts`
- `supabase/functions/send-client-need-notification/index.ts`
- `supabase/functions/send-seller-alert/index.ts`
- `.lovable/plan.md`
