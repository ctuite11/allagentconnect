

# Add Chat Button & Mobile Messages Badge

## Overview
Add the ability for agents to start a chat from another agent's profile, and ensure the Messages link with unread badge is visible on mobile.

---

## Changes Required

### 1. AgentProfileHeader.tsx - Add "Chat" Button

**Current State:** The header has "Contact Agent" (email dialog) and "Save Contact" (vCard download) buttons, but no in-app chat option.

**Changes:**
- Import `useAuthRole` hook to get current user and role
- Import `MessageSquare` icon from lucide-react
- Import `findOrCreateConversation` from `@/lib/startConversation`
- Import `Button` component (already imported)
- Add logic to determine if the Chat button should show:
  - Viewer is logged in
  - Viewer has `role === "agent"`
  - Viewer is not viewing their own profile (`viewerId !== agent.id`)
- Add Chat button next to existing action buttons (both mobile and desktop layouts)
- On click: call `findOrCreateConversation(viewerId, agent.id)` and navigate to `/messages/:conversationId`

**Mobile Layout (lines 139-154):** Add Chat button in the action buttons section

**Desktop Layout (lines 260-293):** Add Chat button inline with Contact Agent and Save Contact

---

### 2. Navigation.tsx - Add Messages to Mobile Menu

**Current State:** Desktop has Messages icon with badge (lines 484-497), but mobile menu (lines 625-691) does not include a Messages link.

**Changes:**
- Add a Messages row in the mobile Agent Tools section (after "Hot Sheets" and before "Profile & Branding")
- Include the `MessageSquare` icon
- Show unread badge count if `unreadCount > 0`
- On click: navigate to `/messages` and close the mobile menu

**Location:** Inside the mobile menu's agent tools section (around line 680)

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/components/AgentProfileHeader.tsx` | Add imports, useAuthRole hook, canChat logic, Chat button (mobile + desktop) |
| `src/components/Navigation.tsx` | Add Messages row with badge in mobile menu agent tools section |

---

## Technical Details

### AgentProfileHeader.tsx

**New imports:**
```tsx
import { MessageSquare } from "lucide-react";
import { findOrCreateConversation } from "@/lib/startConversation";
import { useAuthRole } from "@/hooks/useAuthRole";
```

**Inside component:**
```tsx
const { user, role } = useAuthRole();
const viewerId = user?.id;
const canChat = !!viewerId && role === "agent" && viewerId !== agent.id;
```

**Chat button (matches existing button styling):**
```tsx
{canChat && (
  <Button
    variant="secondary"
    size="sm"
    className="bg-white/20 text-white border-white/30 hover:bg-white/30"
    onClick={async () => {
      const convoId = await findOrCreateConversation(viewerId!, agent.id);
      if (convoId) navigate(`/messages/${convoId}`);
    }}
  >
    <MessageSquare className="h-4 w-4 mr-1.5" />
    Chat
  </Button>
)}
```

### Navigation.tsx

**Mobile menu Messages row (after Hot Sheets, before Profile & Branding):**
```tsx
<button
  onClick={() => {
    navigate("/messages");
    setIsMenuOpen(false);
  }}
  className="flex items-center justify-between w-full py-2 text-slate-700 hover:text-slate-900 transition"
>
  <span className="flex items-center gap-2">
    <MessageSquare className="w-4 h-4" />
    Messages
  </span>
  {unreadCount > 0 && (
    <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
      {unreadCount > 9 ? "9+" : unreadCount}
    </span>
  )}
</button>
```

---

## Definition of Done

- Agent profile shows "Chat" button when viewing another agent's profile (logged in as agent)
- Chat button hidden when viewing own profile or not logged in as agent
- Clicking Chat creates/finds conversation and navigates to `/messages/:id`
- Mobile navigation shows "Messages" with unread badge for agents
- Both mobile and desktop badge counts stay in sync

