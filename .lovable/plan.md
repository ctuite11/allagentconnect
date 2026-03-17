

# Fix Profile Route in Sidebar

The Profile button currently points to `/profile`, but the agent profile editor lives at `/agent-profile-editor`.

## Change

**`src/components/agent-dashboard-v2/DashboardSidebar.tsx`** — line 46:

```tsx
// Before
{ label: "Profile", icon: UserCircle, route: "/profile" },

// After
{ label: "Profile", icon: UserCircle, route: "/agent-profile-editor" },
```

Also applying the previously approved but unimplemented fixes in the same edit:

| Item | Current | New |
|------|---------|-----|
| Messages | `/communications` | `/messages` |
| Admin | `/admin` | `/admin/approvals` |
| Profile | `/profile` | `/agent-profile-editor` |

