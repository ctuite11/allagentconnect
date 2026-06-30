## Goal

Newly activated and existing-but-unconfigured agents should have all four core Communications Center channels **ON by default**, without overwriting agents who already set preferences. A non-blocking note in the Communications Center explains the default.

## Channel mapping

The Comms Center exposes four channel toggles backed by `notification_preferences` columns. They map to the user's labels as:

- Buyer Needs → `buyer_need`
- Listing Broadcasts → `sales_intel` (current UI label "Sales Intel")
- Network Broadcasts → `general_discussion` (current UI label "General Discussions")
- Market Activity → `renter_need` (currently the 4th channel slot)

Only the booleans are defaulted ON. Geographic / price / property-type targeting filters are left untouched — those remain explicit choices and continue to gate broadcast eligibility through `hasNotificationTargetingConfigured`.

## Rules (locked)

1. Auto-enable the four channels when `agent_settings.preferences_set` is `false`/`null`.
2. Never overwrite an agent whose `preferences_set = true`.
3. When an agent saves any change in the Comms Center, set `preferences_set = true` (already happens in `ClientNeedsDashboard`; extend to channel-card saves).
4. No popups, no forced setup. Existing onboarding overlay stays available but is no longer the only path to having channels on.

## Implementation

### 1. Backfill existing active agents (one-time data migration)

For every `agent_settings` row with `account_activated_at IS NOT NULL` and `preferences_set` not `true` (27 agents today):

- Upsert their `notification_preferences` row with `buyer_need = true`, `sales_intel = true`, `renter_need = true`, `general_discussion = true`.
- Only set the four booleans — leave price, property_types, geographic coverage, frequency untouched.
- Do **not** flip `preferences_set` — that flag still means "agent has explicitly configured." This preserves rule 2 for the future and keeps the existing onboarding overlay logic honest (it triggers when no channel is active, which will no longer be the case).

### 2. Default-on at activation time

In `src/pages/AgentAccountSetup.tsx`, after the password-set + `account_activated_at` step succeeds, call a small helper `ensureDefaultCommsChannels(userId)` that:

- Reads `notification_preferences` for the user.
- If row is missing OR all four channel booleans are false AND `agent_settings.preferences_set` is not true → upsert the four booleans to `true`.
- Never touches targeting filters or `preferences_set`.

### 3. Mark preferences_set on first manual change

`src/components/NotificationPreferenceCards.tsx` already writes channel toggles. Extend its save path to also `update agent_settings set preferences_set = true` for the current user (same pattern as `ClientNeedsDashboard.tsx:230`). This ensures rule 2 fires the moment an agent makes a deliberate choice.

### 4. Non-blocking note in Communications Center

In the Comms Center page header (above the channel cards), render a dismissible inline note — not a modal:

> Your communication channels are on by default so you don't miss network activity. You can adjust them anytime.

Behavior:
- Subtle bordered card, neutral palette, small `X` to dismiss.
- Dismissal stored in `localStorage` keyed by user id (`commsCenterDefaultsNoticeDismissed:<userId>`).
- Hidden permanently once `preferences_set = true` even without explicit dismissal.
- Replaces the existing modal-style `CommunicationsChannelsOnboardingOverlay` as the primary surface; the overlay is no longer auto-triggered (channels are no longer all-off), but the file stays in place per the hide-don't-delete rule.

### 5. Edge functions

`send-client-need-notification` and similar broadcast functions already key off `notification_preferences`. No changes needed — they will naturally start including the backfilled agents.

## Files

- New: `src/lib/ensureDefaultCommsChannels.ts`
- Edit: `src/pages/AgentAccountSetup.tsx` (call helper on activation success)
- Edit: `src/components/NotificationPreferenceCards.tsx` (mark `preferences_set = true` on save)
- New: `src/components/communication-center/CommunicationsDefaultsNotice.tsx`
- Edit: Comms Center page (mount the notice; stop auto-opening the overlay)
- Migration via insert tool: backfill `notification_preferences` for the 27 active agents currently missing channel opt-in

## Out of scope

- Renaming UI labels to match the user's wording ("Listing Broadcasts", "Network Broadcasts", "Market Activity"). Current labels (Sales Intel / General Discussions / Renter Needs) stay unless you ask for the rename — happy to do it in a follow-up.
- Changing targeting (price/property type/geography) defaults.
- Deleting the existing onboarding overlay.
