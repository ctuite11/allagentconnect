

# Replace White Sidebar with Dark V2 Sidebar on All Pages

## What Changes

### 1. Update `AppShell.tsx` to use `DashboardSidebar` instead of `SidebarNavigation`
- Remove the `SidebarProvider` wrapper (DashboardSidebar manages its own collapse state)
- Import and render `DashboardSidebar` with `isAdmin` from `useAuthRole()`
- Keep the flex layout but remove the shadcn sidebar infrastructure

### 2. Add Sign Out to `DashboardSidebar.tsx`
- The current dark sidebar has no logout button — add one to the bottom (matching the dark theme styling) using `supabase.auth.signOut()`

### 3. Fix double sidebar on `AgentDashboardV2.tsx`
- This page renders its own `DashboardSidebar` inside the content area, but it's also wrapped by `AgentLayout` → `AppShell` which will now also render `DashboardSidebar`
- Remove the three `<DashboardSidebar>` instances from AgentDashboardV2 so it only gets the one from AppShell

### 4. Keep `SidebarNavigation.tsx` untouched
- File stays in the codebase, just no longer imported/used in AppShell

## Technical Details

**AppShell.tsx** will become:
```tsx
import { DashboardSidebar } from "@/components/agent-dashboard-v2";
import { useAuthRole } from "@/hooks/useAuthRole";

export function AppShell({ children }) {
  const { isAdmin } = useAuthRole();
  return (
    <div className="min-h-screen flex w-full">
      <DashboardSidebar isAdmin={isAdmin} />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
```

**DashboardSidebar.tsx** — add a Sign Out button at the bottom of the `<nav>`:
```tsx
<button onClick={handleLogout} className="flex items-center gap-2.5 ...">
  <LogOut className="h-[18px] w-[18px]" />
  {!collapsed && <span>Sign Out</span>}
</button>
```

**AgentDashboardV2.tsx** — remove all `<DashboardSidebar>` renders and the outer `div.flex.min-h-screen` wrapper since AppShell now provides both.

