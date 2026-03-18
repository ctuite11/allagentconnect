

## Plan: Update Comms route to `/client-needs`

**Single change** in `DashboardSidebar.tsx` line 40:

Change the "Comms" menu item route from `/communications` to `/client-needs`.

```tsx
// Before
{ label: "Comms", icon: Radio, route: "/communications" },

// After
{ label: "Comms", icon: Radio, route: "/client-needs" },
```

No other files or styling changes needed.

