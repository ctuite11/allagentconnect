

# AAC Monogram Fallback, Brighter Sidebar Blue, Clearer New Message Icon

Three small edits across 3 files. No routing, backend, or notification changes.

## Changes

### 1. AAC blue monogram fallback
**File:** `src/components/messaging/UserAvatar.tsx`, line 30

Change `AvatarFallback` classes from `bg-zinc-100 text-zinc-600 font-medium` to `bg-primary text-white font-semibold`. This matches the Figma reference (blue circle, white initials) and propagates to all avatar usages.

### 2. Brighter sidebar active state
**File:** `src/components/agent-dashboard-v2/DashboardSidebar.tsx`, line 100

Change active row background from `bg-zinc-800/40` to `bg-[hsl(221,92%,51%)]/15` — a blue-tinted glow instead of muted gray. The icon already uses `text-[hsl(221,92%,51%)]` so this creates a cohesive blue accent on the selected item.

### 3. Clearer new message icon
**File:** `src/components/messaging/ConversationsList.tsx`, lines 4 and 77

Replace `ArrowUpRight` with `SquarePen` from lucide-react. This is universally understood as "compose/new message." No wiring changes needed — `onNewMessage` already opens `NewConversationDialog`.

