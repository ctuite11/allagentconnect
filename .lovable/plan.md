## Separate Profile UI from Communications Center targeting — approved implementation

### Scope (locked)

- **Decision A: approved.** Hide Profile "Buyer Leads" card on desktop and mobile. Client Incentives already hidden — leave as-is. Preserve all DB values, columns, and handlers.
- **Decision B: approved.** Opportunity targeting reads only `agent_buyer_coverage_areas` rows with `source = 'notifications'`.
- **No data migration.** Profile/DCMLS/import/legacy rows are left untouched. Agents whose only rows are non-notification-sourced fall into the "preferences unset → receive everything" fallback.
- **Queue stays paused.** No live sends until revised dry-run counts are approved.

### Final rule enforced in code

| Agent state | Result |
|---|---|
| Directory-visible + not suppressed + no Comms Center prefs | All qualifying opportunities (fallback) |
| Directory-visible + Comms Center prefs set | Only matching opportunities |
| Not directory-visible (profile incomplete) | "You're Missing Opportunities" reminder instead of real content |

`account_activated_at`, Profile Buyer Leads writes, and buyer/seller incentive fields are never consulted for targeting.

### Files changed

**1. `src/pages/AgentProfileEditor.tsx`**
Wrap the "Buyer Leads" card (starting at line 941) in `{false && (…)}`, matching the existing hidden pattern used for Client Incentives at line 896. State setters, handlers, and DB reads/writes remain intact so historical data and code paths are preserved.

**2. Second mobile rendering path**
Grep the codebase for any other component that renders `IncentivesSection`, a Buyer Leads card, or coverage-area editor on Profile (mobile or desktop). Hide any second surface the same way. Confirmation of "no second path" is included in the post-implementation report.

**3. `src/lib/checkAgentCommunicationPreferences.ts`**
Already correct — `hasNotificationSourcedCoverage` filters `source = 'notifications'`. No change required. Re-verify.

**4. `supabase/functions/_shared/verifiedAgentAudience.ts`**
In the coverage/preferences-set query, add `.eq('source', 'notifications')`. This is the shared helper used by all five notification paths, so a single edit propagates.

**5. Notification edge functions — audit every coverage read**
Add `.eq('source', 'notifications')` to any direct `agent_buyer_coverage_areas` query in:
- `supabase/functions/notify-agents-new-listing/index.ts`
- `supabase/functions/notify-agents-client-need/index.ts` (buyer + renter needs)
- `supabase/functions/notify-agents/index.ts` (broadcasts / seller alerts path)
- `supabase/functions/send-client-need-notification/index.ts`
- `supabase/functions/send-seller-alert/index.ts`

Keep the `00000`/`00001` ZIP sentinel normalization inside `coverageMatches()` as a defensive measure.

**6. No SQL migration.** No column drops, no row updates.

### Report returned before any live send

- Confirmation there is no remaining mobile-only rendering path for Buyer Leads / Buyer Incentives / Seller Incentives on Profile.
- Per-category field manifest:
  - `preferences_set`: `agent_settings.preferences_set = true` AND (`notification_preferences` has explicit `min_price` / `max_price` / `has_no_min` / `has_no_max` / `property_types` OR `agent_buyer_coverage_areas` row with `source='notifications'`).
  - Geography match: `agent_buyer_coverage_areas` where `source='notifications'` only. Fields consulted: `state`, `city`, `zip_code` (with `00000/00001` normalized to empty), `county`, `neighborhood`.
  - Buyer Need opt-out: `notification_preferences` category flag (exact column name reported in the audit).
  - Renter Need opt-out: `notification_preferences` category flag (exact column name reported).
  - Seller/referral matching: `notification_preferences` seller-side flags + Comms-Center-sourced coverage rows.
  - Suppression: `email_unsubscribes` + `suppressed_emails`.
  - Directory visibility (eligibility, not targeting): `agent_settings.agent_status='verified'` + `hide_from_directory=false` + `agent_profiles.first_name`/`last_name`/`headshot_url` present + `email` present.
  - Explicitly not consulted: `account_activated_at`, any Profile-side Buyer Leads write, `agent_profiles.buyer_incentives`, `agent_profiles.seller_incentives`.
- Revised 112 Aldrich Road dry run: audience breakdown + final real recipients + final reminder recipients.
- The 54 eligible IDs (55 pool minus listing agent) with inclusion/exclusion reason per agent.
- Dry runs for the four other notification paths (listing, buyer need, renter need, seller alert, missing-opportunities reminder) with the same counts.

Nothing sends until you approve the revised counts.
