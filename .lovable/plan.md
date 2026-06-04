## Goal

Make the buyer-side **New Message** dialog feel like messaging *your* agent, not picking a recipient from a CRM. Agent-side dialog is untouched.

## Scope

Only `src/components/NewConversationDialog.tsx`, buyer branch (`composeVariant === "buyer"`). All agent-compose code paths, send logic, navigation, and email kick remain identical.

## Visual structure

```text
┌─────────────────────────────────────┐
│  [AAC monogram]  New Message        │
│  Send a message to your agent.      │
├─────────────────────────────────────┤
│  [Headshot]  My Agent               │
│              Chris Tuite            │
│              Compass · Charlestown  │
│              ● Online               │
├─────────────────────────────────────┤
│  Message                            │
│  ┌─────────────────────────────┐    │
│  │ (taller textarea, ~160px)   │    │
│  └─────────────────────────────┘    │
│                                     │
│                    [Send Message]   │
└─────────────────────────────────────┘
```

## Changes

1. **Header**: replace the plain "New message" title with the same `AACMonogram` + title row already used in agent compose, but keep the buyer copy ("New Message" / "Send a message to your agent."). AAC Emerald (`#22C55E`) monogram per brand tokens.

2. **Agent card** (replaces the current `To: …` text block):
   - Round headshot (fallback initials avatar) from `agent_profiles.headshot_url`.
   - Label `My Agent` (uppercase tracking-wide, zinc-400).
   - Agent name (zinc-900, semibold).
   - Sub-line: `company` · `office_city` (omit gracefully when missing).
   - Presence dot using existing `useAgentLastSeen(buyerAgent.id)`:
     - online → green dot + `Online`
     - offline → muted dot + `Last active {formatDistanceToNow}` (fallback "Offline" when null).
   - Drop the `AAC AGENT` badge and email line.
   - Drop the "Messages are shared with your agent and connected search group" helper (out of visual scope).

3. **Remove Context section entirely for buyers**: delete the General / About a listing toggle, the listing picker, and the `recentListings` / listing-search effects that exist only for the buyer branch. Listing-scoped conversations still start from listing pages. `listingContext` stays `"general"` for the buyer send path.

4. **Larger message box**: bump buyer textarea min height to ~140px and max to ~240px (update `resizeMessageArea` cap only when buyer variant). Keep Enter-to-send / Shift+Enter newline.

5. **Footer button**: relabel buyer send button from current copy to `Send Message`, keep existing AAC primary styling and disabled state from `canSend`.

## Data

- Extend the buyer recipient fetch (or a small follow-up query keyed off `buyerAgent.id`) to also pull `headshot_url, company, office_city` from `agent_profiles`. Simplest path: after `fetchBuyerMessageRecipients` resolves and we know the agent id, run one `supabase.from("agent_profiles").select("headshot_url, company, office_city").eq("id", buyerAgent.id).maybeSingle()` inside the dialog and store in local state. No change to the shared `BuyerMessageRecipient` type.
- Presence via existing `useAgentLastSeen` hook — no new infra.

## Out of scope

- Agent-compose dialog.
- Listing-scoped buyer compose (still available from listing pages).
- Any backend/RLS/migration work.
- Other messaging pages or thread list styling.

## Files touched

- `src/components/NewConversationDialog.tsx` (buyer branch only).

No new components, no new exports, no schema changes.
