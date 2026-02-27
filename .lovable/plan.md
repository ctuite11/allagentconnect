

## Problem

`buildCommsUrl()` in `PropertyDetailRightColumn.tsx` generates `/comms?...` — a route that does not exist. All actual messaging routes (`/messages`, `/messages/:id`, `/communications`) are agent-gated via `RouteGuard requireRole="agent"`, so buyers are blocked.

## Fix Plan

### 1. Open `/messages` and `/messages/:id` to buyers

In `src/App.tsx`, change the two message routes from `requireRole="agent"` to allow both agents and buyers:

```tsx
// Before:
<Route path="/messages" element={<RouteGuard requireRole="agent"><Messages /></RouteGuard>} />
<Route path="/messages/:id" element={<RouteGuard requireRole="agent"><Conversation /></RouteGuard>} />

// After:
<Route path="/messages" element={<RouteGuard requireRole={["agent","buyer"]}><Messages /></RouteGuard>} />
<Route path="/messages/:id" element={<RouteGuard requireRole={["agent","buyer"]}><Conversation /></RouteGuard>} />
```

*(Need to verify `RouteGuard` supports array — if not, a small update to accept `string | string[]`.)*

### 2. Rewrite `buildCommsUrl()` to use `findOrCreateConversation` directly

In `PropertyDetailRightColumn.tsx`, replace the URL-builder with the same pattern `ClientDashboard` already uses — call `findOrCreateConversation` and navigate to `/messages/${convId}`:

```typescript
const handleContactAgent = async () => {
  if (isStartingChat) return;
  setIsStartingChat(true);
  try {
    if (stickyAgent?.id && viewerId) {
      const convId = await findOrCreateConversation(viewerId, stickyAgent.id, {
        listingId: listing?.id ?? null,
      });
      if (convId) { navigate(`/messages/${convId}`); return; }
    }
    // Fallback: no sticky agent → support email flow or dashboard
    navigate("/client/dashboard");
  } catch {
    toast.error("Couldn't start message. Please try again.");
  } finally {
    setIsStartingChat(false);
  }
};
```

Remove `buildCommsUrl()` entirely. Update all three Button `onClick` handlers (sticky-agent card, generic fallback, bottom fallback) to call `handleContactAgent`.

### 3. Verify `RouteGuard` accepts array roles

Quick check of `RouteGuard.tsx` — if `requireRole` only accepts a string, update the type to `string | string[]` and the check to `Array.isArray(requireRole) ? requireRole.includes(role) : requireRole === role`.

### Files touched

| File | Change |
|------|--------|
| `src/App.tsx` | Open `/messages` routes to buyers |
| `src/components/RouteGuard.tsx` | Accept array of roles (if needed) |
| `src/components/PropertyDetailRightColumn.tsx` | Replace `buildCommsUrl()` with `handleContactAgent` using `findOrCreateConversation` |

