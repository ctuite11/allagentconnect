## Scope
Update `/access-error` only. Wrap the page in a black header + black footer, with the AAC green monogram and white "All Agent Connect" wordmark in the header.

## Changes

**`src/pages/AccessError.tsx`** (only file touched)
- Replace the current centered layout with: `<div className="min-h-screen flex flex-col bg-white">` containing:
  1. **Black header** (`bg-black border-b border-black`, h-16, max-w-7xl px-5):
     - Left: `<AACMonogram />` colored AAC green (`#22C55E`, h-7 w-7) + wordmark "All Agent Connect" in white (`text-white font-semibold tracking-tight`)
     - Right: nothing (or optional "Sign in" link in zinc-300 → white)
  2. **Main content** (`flex-1`): existing ShieldX icon, heading, copy, Contact Support button — unchanged
  3. **Black footer** (`bg-black text-zinc-400 py-6`): centered small text `© {year} All Agent Connect`
- Remove the standalone `<Logo>` from the body (now in header)
- Imports: drop `Logo`, add `AACMonogram` from `@/components/ui/AACMonogram` and `Link` from `react-router-dom`

No other files, routes, or components are modified. No new shared header/footer component is introduced (scope is one page).
