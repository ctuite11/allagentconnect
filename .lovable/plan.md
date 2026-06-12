# Network Activity — Agent Contact Wiring

Goal: every Active Buyer Demand entry shows the originating agent (name, phone, email) with in-place actions, and the contact block is reusable across other Network Activity feeds.

## 1. New component: `ActivityAgentContact`

Path: `src/components/success-hub/networkActivity/ActivityAgentContact.tsx`

Props:
```ts
type ActivityAgentContactProps = {
  agentId: string;
  agentName: string;
  agentEmail: string | null;
  agentPhone: string | null;
};
```

Renders three controls only — no brokerage, city, state, or other metadata:

- **Name** — button styled as link. Opens `AgentIntelDrawer` (already used in agent search) controlled by local `open` state. No router navigation.
- **Phone** — `<a href="tel:...">` with `Phone` icon, formatted via `formatPhoneNumber`. Hidden when missing.
- **Email** — button with `Mail` icon. Opens `ContactAgentProfileDialog` (existing listing-agnostic agent email dialog) in controlled mode. Falls back to `mailto:` only if the dialog can't be used (no email). Hidden when email missing.

All handlers call `event.stopPropagation()` so the host card doesn't react and scroll stays put.

Styling: compact row (`text-[11px] text-neutral-600`), name in `font-medium text-neutral-900 hover:text-[#0E56F5]`. Sits below the existing buyer-need metadata; card spacing/layout in `NetworkActivitySection` unchanged.

## 2. Wire Active Buyer Demand to real data

Source: `client_needs` table. `client_needs.submitted_by` → `agent_profiles.id`.

New hook: `src/components/success-hub/networkActivity/useActiveBuyerDemand.ts`

- Selects newest ~6 `client_needs` ordered by `created_at desc`.
- Batched `in` query on `agent_profiles` for `id, first_name, last_name, email, phone`.
- Maps each row to:
  ```ts
  {
    id, buyerLabel, location, priceRange, propertyType, timestamp, isNew,
    agent: { id, name, email, phone } | null
  }
  ```
- `buyerLabel` from `description` (truncated) or `Buyer need · {city}`.
- `location` from `city, state`. `priceRange` from `max_price`. `propertyType` from `property_types[]` or `property_type`. `timestamp` relative. `isNew` if within 24h.

`ActiveBuyerDemandCard` swaps `MOCK_BUYER_DEMAND` for the hook. Skeleton (3 rows) while loading. Empty state: single muted line "No active buyer needs yet." inside existing card. Each item renders `<ActivityAgentContact />` below the price/property type line when `agent` is present.

## 3. Other feeds — reuse the component (mock-side adapter)

Per spec the component must be reusable in Recent Listing Activity and Network Broadcasts. We do not rewire those feeds to live data in this pass, but we drop the component into their renderers so the contract is real:

- Extend `ListingActivityItem` and `NetworkBroadcastItem` mocks with optional `agentId/agentEmail/agentPhone`.
- Replace the existing `"{agentName} · {brokerage}"` and inline author lines with `<ActivityAgentContact />`. Brokerage removed per spec ("Do not display brokerage…").
- Mock entries without a real agent id still render — the drawer simply shows an empty intel state until those feeds are wired live.

## 4. Files touched

- add `src/components/success-hub/networkActivity/ActivityAgentContact.tsx`
- add `src/components/success-hub/networkActivity/useActiveBuyerDemand.ts`
- edit `src/components/success-hub/networkActivity/NetworkActivitySection.tsx`
- edit `src/components/success-hub/networkActivity/mockData.ts` (optional agent fields on listing + broadcast items)

No DB migrations, no RLS changes, no route changes. All actions are in-place (drawer, dialog, `tel:`) so Success Hub scroll position is preserved.
