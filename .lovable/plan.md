

# Fix Auth Page Logo to Match Email Template Design

## Problem
The Auth page uses `<Logo variant="primary" />` which renders a multi-colored SVG wordmark ("All Agent" in blue, "Connect" in green). This violates the brand standard and doesn't match the email template design.

## Target Design (from email template)
- Green monogram icon (AACMonogram / command symbol)
- White or dark "All Agent Connect" wordmark in a single neutral color
- Clean, centered lockup

## Changes

**File: `src/pages/Auth.tsx`** (2 locations, lines ~755 and ~904)

Replace:
```tsx
<Logo variant="primary" size="lg" />
```

With the standard brand lockup used in sidebar/headers — the `AACLogo` component (`src/components/ui/AACLogo.tsx`) which renders the green monogram + single-color wordmark. Since the Auth page has a white background, the wordmark color needs to be dark (not white as in AACLogo's current dark-bg version).

**Option**: Import `AACMonogram` directly and pair with dark text, matching the email header pattern but on a light background:

```tsx
<div className="flex items-center justify-center gap-2">
  <AACMonogram className="w-10 h-10 text-emerald-500" />
  <span className="font-extrabold text-xl tracking-tight text-zinc-900"
        style={{ fontFamily: "Manrope, sans-serif" }}>
    All Agent Connect
  </span>
</div>
```

This matches the email template lockup: green monogram + single-color neutral wordmark, no multi-color text.

## Files
1. `src/pages/Auth.tsx` — Replace both `<Logo variant="primary" size="lg" />` instances with the monogram + wordmark lockup using dark text for the light background

