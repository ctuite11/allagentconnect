
# Remove Login Link from Landing Page Header

## Issue
The landing page (`/`) currently displays a "Log in" link in the top right corner of the header (line 49-51). Early registrants are using this to access the auth flow, which bypasses the intended early access funnel.

## Solution
Remove the "Log in" link entirely from the LandingPage header to maintain funnel purity. The landing page should only have the "Request Early Access" CTA routing to `/register`.

---

## Technical Change

**File: `src/pages/LandingPage.tsx`**

**Remove lines 49-51:**
```tsx
// DELETE THIS:
<a href="/auth" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
  Log in
</a>
```

**Result header structure:**
```tsx
<header className="relative bg-transparent">
  <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
    <div className="flex h-20 items-center justify-between pt-4">
      <div className="flex items-center gap-3 -ml-1">
        <Logo size="3xl" />
      </div>
      {/* No login link - funnel goes through /register only */}
    </div>
  </div>
</header>
```

---

## Files to Modify

| File | Action |
|------|--------|
| `src/pages/LandingPage.tsx` | Remove "Log in" anchor tag from header (lines 49-51) |

---

## Result
- Landing page header shows logo only (left side)
- No login link visible to users
- All traffic funneled through "Request Early Access" → `/register`
- Existing registered users can still access `/auth` directly via URL if needed
