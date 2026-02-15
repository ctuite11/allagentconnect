

# Listing Chat: One Message, Two Outcomes

## Overview
Transform `hot_sheet_comments` from a single-comment system into a threaded chat. One `INSERT` per send. The chat drawer and toast notification are both derived from that single row via Supabase Realtime.

## 1. Database Migration

### Add columns to `hot_sheet_comments`
```sql
ALTER TABLE hot_sheet_comments
  ADD COLUMN sender_role text NOT NULL DEFAULT 'client',
  ADD COLUMN sender_id uuid;

-- Enable realtime so INSERT events push to subscribers
ALTER PUBLICATION supabase_realtime ADD TABLE hot_sheet_comments;
```
No new tables. No notification table. Existing RLS policies already allow insert/select.

## 2. New Component: `ListingChatDrawer.tsx`

A `Sheet` (side drawer) showing the full thread for one `(hot_sheet_id, listing_id)` pair.

- **Message list**: All `hot_sheet_comments` rows ordered by `created_at ASC`
  - Client messages: left-aligned, muted background
  - Agent messages: right-aligned, primary background
- **Input + Send button**: Inserts a single row with `sender_role = 'agent'` and `sender_id = auth.uid()`
- **Realtime subscription**: Listens for `INSERT` on `hot_sheet_comments` filtered by `hot_sheet_id` and `listing_id`. New rows append to the list automatically -- no refetch needed.
- Auto-scroll to bottom on new message.

## 3. Update `ListingCard.tsx`

Replace the static comment block with a clickable chat preview:

- Show last message with sender label ("Client:" or "You:")
- Show message count badge
- Clicking opens `ListingChatDrawer`
- New props: `chatMessages` (array), `hotSheetId`, `onNewMessage` callback

```text
+--------------------------------------+
| [MessageSquare] Client: "I like..." |
|                  2 messages  >       |
+--------------------------------------+
```

## 4. Update `HotSheetReview.tsx`

- Fetch ALL comments for the hotsheet (with `sender_role`, `sender_id`, `created_at`)
- Group by `listing_id` into `Record<string, Comment[]>`
- Pass grouped array to each `ListingCard`
- Subscribe to Realtime `INSERT` on `hot_sheet_comments` for this hotsheet
  - On new row: update the grouped comments state (UI updates everywhere)
  - If `sender_role = 'client'`: show toast "New message -- [address]"
- No separate notification storage. Toast is ephemeral UI only.

## 5. Data Flow

```text
Agent clicks Send
       |
       v
INSERT 1 row into hot_sheet_comments
  (sender_role='agent', sender_id=uid)
       |
       +---> Realtime broadcast
       |         |
       |         +---> Client's chat drawer updates (new row appears)
       |         +---> Client's listing card "last message" updates
       |         +---> Client sees toast: "New message - 123 Main St"
       |
       +---> Agent's local state updates immediately (optimistic)
```

Same flow in reverse when client sends.

## Files

| File | Action |
|------|--------|
| Database migration | Add `sender_role`, `sender_id` columns; enable realtime |
| `src/components/ListingChatDrawer.tsx` | **New** -- chat thread UI + send + realtime subscription |
| `src/components/ListingCard.tsx` | Update comment block to clickable preview, open drawer |
| `src/pages/HotSheetReview.tsx` | Fetch all comments, group by listing, realtime subscription + toast |

## What is NOT happening
- No separate notification table or row
- No duplicate inserts
- No second "notification message"
- Toast is ephemeral UI derived from the same Realtime event
