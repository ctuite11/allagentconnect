
Visual-only correction — increase readability, add breathing room, fix avatar fallback, neutralize email color. No functional/routing/data changes.

## 1. `src/components/success-hub/SuccessHubHero.tsx`

Card container: `rounded-xl border border-neutral-200 bg-white px-8 py-7 sm:py-8 shadow-sm` (more generous padding).

Row: `flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10`.

### Left column (`min-w-0 flex-1`)

Explicit vertical rhythm (no wrapping `space-y-*`):

- H1 "Success Hub": `text-2xl sm:text-[26px] font-semibold tracking-tight text-neutral-900`
- `AacTitleAccent` — `mt-2`
- Greeting "Hi, {first}": `mt-4 text-lg font-semibold text-neutral-800` (larger, prominent secondary heading, comfortable gap below title)
- Subtitle "Manage your buyers…": `mt-2 max-w-xl text-sm leading-relaxed text-neutral-600`
- Buttons wrapper: `mt-6 flex flex-wrap gap-2` — buttons themselves unchanged.

### Right profile block

Container: `flex w-full min-w-0 shrink-0 flex-row items-center gap-4 lg:w-auto` (removes the fixed `22rem` width so it hugs its content and doesn't float in empty space; `items-center` vertically balances against the taller left column).

`AgentAvatar` — keep `size="xl"`, `avatarClassName="h-16 w-16 border-2 border-zinc-100"` (16 vs current 14, better balanced with the larger type). Add:

```
initialsFallback={{
  initials: initialsFromDisplayName(fullName),
  className: "bg-neutral-200 text-neutral-700 font-semibold text-base",
}}
fallbackClassName="border border-zinc-200"
```

so a missing headshot renders a **gray filled circle with initials** (e.g. `AT`) instead of an empty white circle. Presence dot rendered by AgentAvatar is untouched.

Text stack: `min-w-0 space-y-1`

- Name: `text-base font-semibold text-neutral-900` (up from text-sm)
- Company: `text-sm text-neutral-600` (up from text-xs)
- Title (if any): `text-sm text-neutral-500`
- AAC id: `font-mono text-xs text-neutral-500` (up from text-[11px]/neutral-400)

Import `initialsFromDisplayName` from `@/lib/initials`.

## 2. `src/components/success-hub/networkActivity/ActivityAgentContact.tsx`

Email button className: replace `text-[#0E56F5] hover:underline` with `text-neutral-700 hover:text-neutral-900 hover:underline`. Keep icon, keep click handler that opens the internal `AgentEmailQuickDialog`. Agent name link stays AAC blue. Phone stays neutral non-clickable (already a `span`).

## 3. `src/pages/CommunicationsFeed.tsx`

Email button (~line 233): swap `text-[#0E56F5] hover:underline` → `text-neutral-700 hover:text-neutral-900 hover:underline`. Name link (~line 218) stays AAC blue. No other changes.

## Out of scope

Routing, presence logic, avatar component internals, email dialogs, message logic, card structure, data queries, fonts, button sizing/styling — all untouched.

## Files changed

1. `src/components/success-hub/SuccessHubHero.tsx`
2. `src/components/success-hub/networkActivity/ActivityAgentContact.tsx`
3. `src/pages/CommunicationsFeed.tsx`
