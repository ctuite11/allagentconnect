

# Add Member Login Link + Session Redirect to Landing Page

## Single File Change: `src/pages/LandingPage.tsx`

### 1. Add imports

Add `useEffect` from React and `supabase` from `@/integrations/supabase/client` at the top of the file.

### 2. Session redirect on mount

Inside the `LandingPage` component, add a `useEffect` that calls `supabase.auth.getSession()`. If a session exists, redirect to `/home` with `replace: true`.

### 3. Member Login link in header

Replace the comment at line 49 (`{/* No login link - funnel goes through /register only */}`) with a visible text link:

```
Member Login →
```

Styled with zinc palette (`text-zinc-500 hover:text-zinc-900`), no button chrome, positioned on the right side of the header. Links to `/home` via `navigate()`.

## No other changes

- No backend, auth, or routing modifications
- No new files or components
- Single-file edit to `src/pages/LandingPage.tsx`

