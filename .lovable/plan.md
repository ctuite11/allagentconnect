## Root cause (confirmed by re-reading the code)

`src/pages/MessagingWorkspace.tsx` currently sets on the split container:

- mobile: `h-[calc(100dvh-9rem)] min-h-[520px] overflow-hidden`
- buyer mobile: `h-[calc(100dvh-8rem)] min-h-[520px] overflow-hidden`

`AppShell` on mobile is `100svh` and the content area breaks down to: mobile top bar `h-14` (56px) + `AgentPageHeader`/`AacPageIntro` (~80–100px) + banners. On the user's 384×625 viewport the space actually available inside the AppShell scroll root is roughly 430–470px, but:

1. `min-h-[520px]` forces the split container taller than that available space, so the outer AppShell scroll root becomes the scroller. Two nested scrollers on mobile fight for touch — the inner `ConversationsList` (`min-h-0 flex-1 overflow-y-auto`) then never receives the pan gesture, so the inbox looks "unscrollable".
2. Because the outer page is what scrolls, tapping a thread navigates to `/messages/:id` but the conversation column also sizes off the same broken math, so nothing meaningful appears — user perceives "can't open a thread".

## Fix (presentation-only, mobile only)

Edit only `src/pages/MessagingWorkspace.tsx`:

- Remove `min-h-[520px]` from the split container on mobile (both agent and buyer variants). Keep the existing desktop `md:`/`lg:` rules unchanged.
- Recompute the mobile height so the split container fits **inside** the AppShell scroll area (no outer page scroll):
  - Agent: `h-[calc(100dvh-11rem)]` (accounts for AppShell mobile top bar `h-14` + `AgentPageHeader` with padding).
  - Buyer: `h-[calc(100dvh-10rem)]` (buyer variant has no AppShell top bar but has `AacPageIntro` + page padding).
  - Add a small `min-h-[360px]` floor so ultra-short viewports still show a usable list, but well under the available area so it never forces outer scroll.
- Keep `overflow-hidden` on the split container so its children (list panel / conversation panel) own their own internal scroll via `min-h-0 flex-1 overflow-y-auto` (already in `ConversationsList` and `ConversationPanel`).
- Keep the current single-pane swap on mobile: when `selectedConversationId` is set, list is `hidden` and conversation panel gets `flex h-full min-h-0 flex-1`; when unset, list gets `flex h-full min-h-0 flex-1` and the conversation panel is `hidden`.

No changes to `ConversationsList`, `ConversationPanel`, routes, hooks, data fetching, or business logic. Desktop (`md+`/`lg+`) layout classes are untouched.

## Verification

- 384×625 mobile viewport at `/messages`:
  - The page itself does NOT scroll; only the inbox list scrolls internally.
  - Tapping a thread swaps to `/messages/:id`, list hides, conversation panel fills the visible area and its message stream scrolls internally.
  - Back button returns to the inbox with scroll position preserved.
- Repeat for `/client/messages` (buyer variant, no AppShell top bar).
- Desktop (`md+`) two-column layout unchanged.
