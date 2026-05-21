## Targeted audit: `/favorites`

You’re right — the problematic target is the Favorites flow, not Admin Approvals.

What I verified:
- Hard navigation to `/favorites` loads the app bundle with no runtime error.
- The page is then redirected to `/auth`.
- No Favorites data requests are visible before the redirect, which means the failure happens in the auth/routing gate before the Favorites query meaningfully runs.
- The existing code has multiple independent auth checks on the Favorites path, so the page can decide “not signed in” from a transient auth-read result even after the global route guard has started resolving auth.

## Root causes on the Favorites path

### 1. `/favorites` has layered auth decisions

Current route:

```tsx
<Route path="/favorites" element={<RouteGuard requireAuth><FavoritesEntry /></RouteGuard>} />
```

Then `FavoritesEntry` reads global auth role again:

```tsx
if (role === "agent" || role === "admin") return <Navigate to="/my-favorites" replace />;
if (role === "buyer") return <BuyerFavorites />;
return <Navigate to="/auth" replace />;
```

So even when `RouteGuard` allows an authenticated user, `FavoritesEntry` can still redirect to `/auth` if `role` is temporarily `null` or unresolved.

That is the same class of bug as before: render/redirect before auth + role are fully known.

### 2. `Favorites.tsx` does its own `getUser()` check and redirects

Inside `src/pages/Favorites.tsx`:

```tsx
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  toast.error(...);
  navigate("/auth");
  return;
}
```

This is fragile on hard refresh because `getUser()` validates against the auth server. If token restore/refresh is still settling or a transient auth call hiccups, the page navigates away even though the session may recover.

Favorites should not own auth routing. The route guard already owns auth routing.

### 3. `/my-favorites` is not protected consistently

Agents/admins hitting `/favorites` are redirected to `/my-favorites`, but `/my-favorites` is currently under `AgentLayout` without `RouteGuard`:

```tsx
<Route path="/my-favorites" element={<MyFavorites />} />
```

Then `MyFavorites.tsx` also calls `supabase.auth.getUser()` and navigates to `/auth` if it doesn’t immediately get a user.

So the agent/admin Favorites path has the same hard-refresh fragility as buyer Favorites.

### 4. Favorites data fetches are not gated by auth readiness

Favorites data should load only after the global auth provider has finished restoring session and resolving role. Right now the page still performs its own auth read on mount.

The durable fix is to make Favorites consume the existing global auth state instead of doing browser-side `getUser()` redirects.

## Implementation plan

### Step 1: Make `FavoritesEntry` wait instead of redirecting on temporary `role=null`

Update `src/App.tsx` `FavoritesEntry`:

- Keep the existing loading skeleton while `useAuthRole().loading` is true.
- If there is a user but role is still `null`, show a loading state, not `/auth`.
- Only redirect to `/auth` when global auth says there is no user after loading is complete.
- Keep existing role routing:
  - admin/agent → `/my-favorites`
  - buyer → `<BuyerFavorites />`

This prevents `/favorites` from bouncing to `/auth` during the role-resolution gap.

### Step 2: Protect `/my-favorites` with `RouteGuard`

Update `src/App.tsx`:

```tsx
<Route path="/my-favorites" element={<RouteGuard requireRole={["agent", "admin"]}><MyFavorites /></RouteGuard>} />
```

This makes the agent/admin Favorites path use the same single auth gate as other protected workspace routes.

### Step 3: Refactor `Favorites.tsx` to use `useAuthRole()` instead of `getUser()` for page auth

Update `src/pages/Favorites.tsx`:

- Import `useAuthRole`.
- Replace `checkAuth()` with an effect keyed by global auth state:
  - if auth is still loading: do nothing
  - if no user after loading: let `RouteGuard` redirect; do not run local `navigate("/auth")`
  - if user exists: set local user and call `fetchFavorites(user.id)`
- Remove the page-level `getUser()` redirect.

This makes Favorites wait for the same auth-ready source as the route guard.

### Step 4: Refactor `MyFavorites.tsx` the same way

Update `src/pages/MyFavorites.tsx`:

- Import `useAuthRole`.
- Do not call `supabase.auth.getUser()` for initial page auth.
- Use the global `user.id` from `useAuthRole()` once loading is complete.
- Let `RouteGuard` own redirects.
- Keep the existing favorites queries and UI unchanged.

### Step 5: Keep data queries unchanged, only change auth gating

Do not redesign the Favorites UI.
Do not change favorites tables, RLS, or listing-card behavior.
Do not change the buyer/agent visual shells.

The only behavior change is: Favorites waits for authenticated state before querying or redirecting.

### Step 6: Verify the exact failure

After implementation, verify:

1. Hard refresh `/favorites` as buyer:
   - stays on `/favorites`
   - shows buyer Favorites or empty state
   - no bounce to `/auth`
2. Hard refresh `/favorites` as agent/admin:
   - redirects to `/my-favorites`
   - loads agent/admin Favorites
   - no bounce to `/auth`
3. Hard refresh `/favorites` signed out:
   - clean redirect to `/auth`
4. Console:
   - no auth errors
   - no repeated redirect loop

## Files to change

- `src/App.tsx`
- `src/pages/Favorites.tsx`
- `src/pages/MyFavorites.tsx`

No database or backend changes are needed.