

# Fix Property Detail header — actually move logo up and tighten price position

## Root cause
The outer wrapper at line 411 has `pt-20` (80px top padding), which is likely there to clear the AppShell navigation bar. The inner `pt-1` on the logo row has no visible effect because the 80px gap above it dominates. The previous changes were correct but too subtle to notice against this large padding.

## File
`src/pages/PropertyDetail.tsx`

## Changes

### 1. Reduce outer top padding
Line 411: Change `pt-20` → `pt-14` to bring the entire page content closer to the top while still clearing the nav bar. This moves the logo visibly upward.

### 2. Remove remaining inner top padding on logo row
Line 428: Change `pt-1` → `pt-0` so the logo sits flush at the top of the content area.

### 3. Tighten spacing between price row and hero image
Line 453: Change `pb-2` → `pb-1` to bring the price block closer to the hero image's top-right corner.

## Result
```text
[nav bar]
─── less gap (pt-14 instead of pt-20) ───
[AAC logo (flush, no inner padding)]

[← back]

[pin + address .................. price]
[................................... $/sf]
[hero image ─────────────────────────────]
```

The logo will move noticeably higher, and the price will sit tighter against the hero image's top-right corner. All changes page-local to `PropertyDetail.tsx`.

