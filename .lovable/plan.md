## Goal

Two small presentation tweaks in the Messaging UI:

1. **Buyer avatars in chats** render as a neutral initials bubble (same as Success Hub > My Buyers BuyerCard) instead of the white AAC monogram on a blue circle. Agents (and anyone with a real headshot) are unchanged.
2. **Conversation list rows** alternate with a light gray background (zebra striping) for easier scanning. The selected row keeps its existing white "selected" treatment.

## Scope (frontend only, presentation)

### 1. Buyer initials avatar

1. `src/components/ui/AgentAvatar.tsx` — add optional `initialsFallback?: { initials: string; className?: string }`. When set and `headshotUrl` is empty, render the initials inside `AvatarFallback` instead of `<AACMonogram />`. Default behavior preserved.
2. `src/lib/initials.ts` *(new)* — extract `initialsFromDisplayName` (first+last initial, single-word → first 2 chars, uppercase). Update `src/components/agent/AgentBuyerActivityHeaderCard.tsx` to import from here (no visual change).
3. `src/components/messaging/UserAvatar.tsx` — add `isBuyer?: boolean`. When true, pass `initialsFallback={{ initials: initialsFromDisplayName(name), className: "bg-neutral-200 text-neutral-800 text-[11px] font-semibold" }}` to `AgentAvatar`.
4. `src/hooks/useConversationThreads.ts` — add `otherUserIsAgent: boolean` to `ThreadSummary`, populated from existing `profile?.isAgent ?? false` (already returned by `resolveDisplayProfiles`).
5. `src/components/messaging/ConversationsList.tsx` — pass `isBuyer={!thread.otherUserIsAgent}` to the row `<UserAvatar>`.
6. `src/components/messaging/ConversationPanel.tsx` — pass `isBuyer={!details.otherUserIsAgent}` to the header `<UserAvatar>`.
7. `src/components/messaging/MessageRow.tsx` — incoming-message header avatar: forward an `isBuyer` flag (parent passes `!details.otherUserIsAgent` from `useConversation`). Own-message rows unchanged.

### 2. Alternating row background in conversation list

8. `src/components/messaging/ConversationsList.tsx` — inside the `filtered.map((thread, idx) => …)` loop, when the row is **not** selected, append `idx % 2 === 1 ? "bg-neutral-50" : "bg-white"` to the row container class. The existing `buyerMessagingThreadRow` hover/focus styles stay; only the resting background alternates. Selected rows keep their current white + ring treatment so the active conversation always stands out.

## Visual spec

- **Initials bubble:** circle, same slot size (`lg` = `h-10 w-10`), `bg-neutral-200 text-neutral-800`, `text-[11px] font-semibold` (matches BuyerCard token `bg-neutral-200 text-neutral-800`).
- **Zebra rows:** odd rows `bg-white`, even rows `bg-neutral-50`. No border change. Hover state unchanged.
- Real `headshotUrl` always wins over initials fallback.

## Out of scope

- `ListingChatDrawer.tsx` (legacy hot-sheet drawer) and the inline `<User>` icon in `src/pages/Conversation.tsx`.
- No DB / RLS / edge function / business logic changes.
- No change to agent avatars, presence dot, or message bubble colors.
