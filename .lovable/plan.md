## Plan

1. **Stop opening a deleted thread from restoring it**
   - Remove the automatic unarchive that currently runs when a conversation is merely opened.
   - Keep unarchive behavior only for actual new messages, where the backend trigger already restores both participants.

2. **Make delete/archive sticky in the UI**
   - Add a local “just deleted” guard in the conversation thread hook.
   - When a thread is deleted, remove it immediately and filter it out from any near-term refetch/realtime refresh so it does not flash back in.
   - If the deleted thread is currently open, navigate back to the messages root.

3. **Fix stale unread count badge**
   - Update the unread-count hook to refresh not only when a message arrives, but also when the user’s participant row changes, such as `last_read_at` updates or archive changes.
   - Ensure the messages header badge drops to zero after the open conversation is marked read.

4. **Fix blank selected state after inbox is empty**
   - If the selected conversation is no longer present in the inbox after delete/archive, show the normal “Select a conversation” state instead of leaving the page looking blank or mismatched.

5. **Verify with the current reported conversation**
   - Check that deleting the thread removes it from the visible list and it stays gone after refetch.
   - Check that the buyer Messages nav unread badge clears when the conversation is read.

## Technical notes

- Frontend files likely affected:
  - `src/hooks/useConversationThreads.ts`
  - `src/hooks/useConversation.ts`
  - `src/hooks/useUnreadConversations.ts`
  - `src/pages/MessagingWorkspace.tsx`
- No database migration is planned unless implementation reveals the unread cursor update is blocked by access rules.