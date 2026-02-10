

# Fix: Early Access Agent Deletion Not Removing Auth Account

## The Problem

When you deleted the early access agent (`christuitet11@gmail.com`), only the `agent_early_access` row was removed. The auth account (`45251fc5-3e5a-4021-9ce7-1c8d4bb792c0`) was **never deleted** because the early access deletion branch (line 38-53 in `DeleteAgentDialog.tsx`) returns early without calling the `delete-users` edge function.

That's why re-registering with the same email says "email in use" -- the auth user is still there.

## Fix (2 parts)

### Part 1: Clean up the orphaned auth user now

Invoke the `delete-users` edge function with the email `christuitet11@gmail.com` to remove the orphaned auth account immediately.

### Part 2: Fix `DeleteAgentDialog.tsx` — early access branch

**Current code (lines 38-53):**
Deletes the `agent_early_access` row and returns. Never touches auth.

**Updated code:**
Before returning, call `delete-users` with the agent's **email** (not ID) so the edge function looks up the correct auth user and deletes it. The `delete-users` function already supports email-based lookup.

```
// After deleting early access record, also remove any auth account
await supabase.functions.invoke("delete-users", {
  body: { emails: [agent.email] },
});
```

### Part 3: Fix `BulkDeleteAgentsDialog.tsx` — same issue

The bulk delete dialog has the identical early access branch that skips auth deletion. Add the same `delete-users` call there.

## Files Changed

- `src/components/admin/DeleteAgentDialog.tsx` — add auth deletion to early access branch
- `src/components/admin/BulkDeleteAgentsDialog.tsx` — add auth deletion to early access branch

## What This Does Not Change

- Real agent deletion flow (already works correctly)
- The `delete-users` edge function (already supports email lookup)
- Database schema
- Any other files

