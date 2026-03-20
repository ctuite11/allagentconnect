
Fix the Success Hub communication entry points back to Buyer Needs and leave everything else untouched.

## What I found
There are two dashboard communication components in the codebase, and both are currently pointing to the wrong route:
- `src/components/success-hub/DashboardCommunications.tsx`
  - header CTA goes to `/communications`
- `src/components/agent-dashboard-v2/CommunicationsPanel.tsx`
  - header CTA goes to `/communications`
  - each conversation row also goes to `/communications`

Your backend/app routing already confirms the intended Buyer Needs route is `/client-needs`:
- `src/App.tsx` has `/client-needs`
- `src/App.tsx` also has `/communication-center` redirecting to `/client-needs`
- sidebar Comms item already points to `/client-needs`

## Plan
1. Update `src/components/success-hub/DashboardCommunications.tsx`
   - change the “Open Comm Center” button target from `/communications` to `/client-needs`

2. Update `src/components/agent-dashboard-v2/CommunicationsPanel.tsx`
   - change the “Open Inbox” button target from `/communications` to `/client-needs`
   - change each conversation row click target from `/communications` to `/client-needs`

## Scope
Only these route targets will be changed.
I will not touch:
- Messages page
- Sidebar
- layout
- unread logic
- visual styling
- any other communication or messaging behavior

## Result
From Success Hub, opening the communication center will go to Buyer Needs (`/client-needs`) again, consistently across both dashboard communication components.
