# Hide "Developments" from the sidebar until launch

## What changes

The agent sidebar (the dark left navigation) currently shows **Developments** to every signed-in agent. This plan hides that entry behind one reversible switch, following the same pattern already used for DCMLS and Developer access.

1. **One new switch** — `DEVELOPMENTS_UI_ENABLED = false` added to `src/config/featureFlags.ts`, documented like the existing flags so launch is a one-word flip back to `true`.
2. **Sidebar filter** — `src/components/agent-dashboard-v2/DashboardSidebar.tsx` already drops the DCMLS entry from its menu list when that flag is off. The same filter line gains one more condition so the Developments entry is left out of the list. The entry itself stays in the code (hidden, not deleted), so restoring it later is only a flag change.
3. **Guard test** — a small test file (mirroring the existing DCMLS and Developer-access visibility tests) that asserts the switch is off and that the sidebar filters the Developments entry, so this can't silently come back.

## What stays exactly as it is

- The Developments pages, their data, and everything behind them remain in place and reachable by direct link — this change only removes the sidebar entry.
- The admin "Dev reviews" sidebar entry and the admin review screens are untouched.
- The Developer Portal's own "Developments" tab needs no change — it is already hidden by the existing Developer access switch.
- No backend, database, email, Hot Sheet, listing, or publishing changes.

## Technical details

- `src/config/featureFlags.ts`: add `export const DEVELOPMENTS_UI_ENABLED = false;` with a doc comment in the style of the other flags.
- `src/components/agent-dashboard-v2/DashboardSidebar.tsx`: import the flag and extend the existing `baseMainMenu.filter(...)` (line ~179, currently `DCMLS_SETTINGS_UI_ENABLED || item.route !== "/agent/dcmls/leads"`) so it also excludes `item.route !== "/developments"` when the new flag is off. Desktop and mobile drawers both render from this one list, so both are covered by the single edit.
- New `src/lib/developmentsUiVisibility.test.tsx`: asserts `DEVELOPMENTS_UI_ENABLED` is `false` and that the sidebar source filters the `/developments` entry — the same source-read assertion style used in `src/lib/dcmlsUiVisibility.test.tsx`.
- Verification: type-check, run the new test plus the existing visibility tests, confirm the build log is clean, then a signed-in preview check that the sidebar no longer shows Developments while every other entry (Success Hub, Search, Communications Center, Messages, Buyers, Agent Network, Contacts, Listings, Hot Sheets, Profile, Settings) still renders in the same order.
- Nothing is deployed by this plan; deployment waits for your go-ahead through GitHub main → allagentconnect.com.
