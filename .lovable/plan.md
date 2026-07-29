## Problem

On mobile (`/messages` and `/client/messages`), the inbox can't be scrolled and tapping a thread doesn't reveal the conversation.

Root cause in `src/pages/MessagingWorkspace.tsx`:

1. The workspace uses `flex min-h-0 flex-1 flex-col` and the split container uses `overflow-hidden` + `flex-1`, but on mobile there is **no fixed-height ancestor** (the desktop `md:h-[min(560px,calc(100dvh-11rem))]` only applies at `md+`). So the flex children collapse and the overflow-hidden clips whatever renders — the list can't scroll, and when a thread is picked, the conversation panel has 0 height.
2. The list column is locked to `h-[min(38dvh,320px)]` on mobile, which is too short and doesn't participate in a scrollable page flow.

## Fix (mobile only, presentation-only)

Edit only `src/pages/MessagingWorkspace.tsx`:

- Give the split container an explicit mobile height so its flex children get real space:
  - Add `h-[calc(100dvh-9rem)] min-h-[520px]` on mobile (buyer variant: `calc(100dvh-8rem)`), keep the existing `md:`/`lg:` height rules.
- List column on mobile:
  - When no thread is selected: `flex h-full min-h-0 flex-1` (fill the split container, allow inner list to scroll) instead of the fixed 38dvh box.
  - When a thread is selected: keep `hidden` (single-pane behavior on mobile) and let the conversation panel take `h-full min-h-0 flex-1`.
- Conversation column on mobile:
  - When a thread is selected: `flex h-full min-h-0 flex-1`.
  - When no thread is selected: `hidden` on mobile so the inbox owns the viewport (currently it renders an empty panel below the list, wasting space and confusing tap targets).
- Keep all `md:`/`lg:` classes untouched so desktop/tablet layout is unchanged.

No changes to `ConversationsList`, `ConversationPanel`, routing, data, or business logic.

## Verification

- Load `/messages` on a 384px viewport: inbox fills the viewport and scrolls.
- Tap a thread: URL becomes `/messages/:id`, list hides, conversation panel fills the screen and scrolls internally; back button returns to the inbox.
- Repeat for `/client/messages` (buyer variant).
- Desktop (`md+`) layout unchanged: two columns side-by-side with the existing capped height.
