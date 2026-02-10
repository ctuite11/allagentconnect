

# Fix: Send Approval Email After Early Access Agent Verification

**Single file:** `src/pages/AdminApprovals.tsx`

## What's Wrong

When you verify an early access agent, the `convert-early-access-to-account` function skips email if the user already exists in auth. The approval email function (`send-agent-approval-email`) is never called for early access agents — only for "real" agents.

## Exact Edit

Insert 9 lines after line 293 (after the early access status update succeeds, before the toast):

```typescript
// Send approval notification email
await supabase.functions.invoke("send-agent-approval-email", {
  body: {
    userId: null,
    email: agent.email,
    firstName: agent.first_name,
    approved: true,
    isEarlyAccess: true,
  },
});
```

## Why This Is Safe

- `send-agent-approval-email` already handles `isEarlyAccess: true` (validated by reading the full edge function code)
- No other files changed
- No edge function changes
- No database changes
- Rejection path (line 296+) is untouched
- Real-agent verification path is untouched

