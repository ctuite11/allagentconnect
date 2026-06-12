# Success Hub — Reorder + Network Activity mirrors Comms Channels

## New Success Hub page order

1. **Hero + Stat row** (unchanged)
2. **Network Activity** — compact 4-channel preview grid (see below)
3. **Newest Verified Agents** — pulled out as its own row under Network Activity
4. **Listing Activity** — renamed from "Market activity" (`MarketActivityRow`); keeps Sale/Rental toggle
5. **My Buyers** — `DashboardBuyersTable`, full-width
6. **Messages** — `DashboardCommunications`, full-width; rows stay clickable
7. **My Listings** — unchanged
8. **Communications Center channel cards** — `NotificationPreferenceCards` at the bottom (Buyer Needs, Sales Intel, Renter Needs, General Discussions)

## Network Activity — 4 channel previews

Replace the current Active Buyer Demand / Recent Listing / Broadcasts / Showing Pulse mix with a strict mirror of the four Communications Center channels. Rendered in a `lg:grid-cols-2` grid so nothing runs endlessly down the page.

Each preview card shows:

- **Header**: channel name + icon + "View all →" link to `/communications` filtered to that channel (`?channel=buyer_needs` etc.)
- **Body**: **latest 3 items only**, each item showing:
  - Title / short summary (one line, truncated)
  - Timestamp (relative)
  - `ActivityAgentContact` row: agent name (opens `AgentIntelDrawer`), phone (`tel:`), email (`ContactAgentProfileDialog`)
- **Empty state**: short "No recent activity" line

### Channel → data mapping

| Channel | Source table | Title field |
|---|---|---|
| Buyer Needs | `client_needs` where buyer-side (existing `useActiveBuyerDemand` query, limit 3) | description / city fallback |
| Sales Intel | `listings` newest non-draft, `listing_type = 'for_sale'`, limit 3 | address + city |
| Renter Needs | `client_needs` where `property_types` contains a rental type OR `agent_match_submissions` rental rows, limit 3 | description / city fallback |
| General Discussions | `agent_messages` newest, limit 3 (broadcast/discussion posts) | preview text |

Agent contact comes from the joined `agent_profiles` row via `submitted_by` / `agent_id` / `author_id`.

## Renames / terminology

- `NotificationPreferenceCards`: rename the **"Discussion"** card to **"General Discussions"** (title + any matching label). Keep its key/id unchanged.
- `MarketActivityRow`: header text **"Market activity" → "Listing Activity"** (loaded + loading states); update helper copy to "Newest and pre-market listings across AAC." No data/logic changes.

## Files to change

- `src/pages/success-hub/SuccessHubDashboard.tsx` — reorder JSX; split Buyers/Communications grid into two stacked sections; render `<NewestVerifiedAgentsRow />` and `<NotificationPreferenceCards />` at the bottom inside `AgentSectionCard`.
- `src/components/success-hub/networkActivity/NetworkActivitySection.tsx` — replace inner grid with four `ChannelPreviewCard`s (Buyer Needs, Sales Intel, Renter Needs, General Discussions). Drop `RecentListingActivityCard`, `NetworkBroadcastsCard`, `ShowingMarketActivityCard` from the grid. Export `NewestVerifiedAgentsRow` for standalone use.
- `src/components/success-hub/networkActivity/ChannelPreviewCard.tsx` (new) — generic shell: title + icon + "View all →" + capped 3-item list rendering `ActivityAgentContact` per item.
- `src/components/success-hub/networkActivity/useChannelPreviews.ts` (new) — four hooks (`useBuyerNeedsPreview`, `useSalesIntelPreview`, `useRenterNeedsPreview`, `useGeneralDiscussionsPreview`), each returning `{ items: ChannelPreviewItem[], loading }` with `limit: 3`. Reuses the existing `useActiveBuyerDemand` mapping pattern.
- `src/components/success-hub/MarketActivityRow.tsx` — header rename only.
- `src/components/NotificationPreferenceCards.tsx` — change "Discussion" → "General Discussions".

## Out of scope

- No DB schema, RLS, or route changes.
- No edits to `ChannelPanel`, `ActivityAgentContact`, `AgentIntelDrawer`, or `ContactAgentProfileDialog`.
- Messages row click behavior preserved as-is.
- Communications Center page itself unchanged (the "View all" links rely on its existing channel filter; if a channel param isn't yet supported it will land on the default view — wiring the filter parser is a separate task).
