

# Fix: Add Buyer Role Check to Auth Routing

## Problem
Both `routeUser()` and `handleSession()` check for admin role, then fall through to agent-only logic. Buyers get treated as unverified agents.

## Changes

### 1. `src/pages/AuthCallback.tsx` — `routeUser()` (after line 304)

Insert buyer check between the admin hard-stop and the agent status check:

```typescript
// PRIORITY 2: Check buyer role
const { data: isBuyer } = await supabase.rpc("has_role", {
  _user_id: userId,
  _role: "buyer",
});

if (isBuyer === true) {
  authDebug("routeUser BUYER_REDIRECT", { action: "terminal_redirect" });
  didNavigate.current = true;
  navigate("/client/dashboard", { replace: true });
  return;
}

// PRIORITY 3: Check agent status (existing code, renumbered)
```

### 2. `src/pages/Auth.tsx` — `handleSession()` (after line 248)

Insert buyer check between admin hard-stop and agent status fetch:

```typescript
// PRIORITY 2: Check buyer role
const { data: isBuyer } = await supabase.rpc("has_role", {
  _user_id: session.user.id,
  _role: "buyer",
});

if (isBuyer === true) {
  authDebug("handleSession BUYER_REDIRECT", { action: "terminal_redirect" });
  if (mounted) {
    didNavigate.current = true;
    navigate("/client/dashboard", { replace: true });
  }
  return;
}
```

## Files Modified

| File | Change |
|------|--------|
| `src/pages/AuthCallback.tsx` | Add `has_role(buyer)` check in `routeUser()` after admin check |
| `src/pages/Auth.tsx` | Add `has_role(buyer)` check in `handleSession()` after admin check |

## No database changes needed
The `user_roles` table already has the correct buyer role. This is purely a routing fix.

