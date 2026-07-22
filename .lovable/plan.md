## Plan

Fix the mobile Admin Approvals header so the team approval entry point is visible on a phone.

### Changes

1. **Mobile-friendly admin toolbar**
   - Change the signed-in/admin action bar from a single horizontal row to a responsive layout.
   - On mobile, stack/wrap the actions so **Team Approvals** is not pushed off-screen.
   - Keep the current desktop layout visually unchanged as much as possible.

2. **Prioritize Team Approvals**
   - Keep **Team Approvals** near the front of the toolbar.
   - Give it enough width on mobile so the label and pending count badge are readable.

3. **Keep existing behavior**
   - Button still routes to `/admin/team-approvals`.
   - Pending count badge still displays when count is greater than 0.
   - No schema changes and no approval logic changes.

### Verification

- Open `/admin/approvals` at mobile width.
- Confirm the **Team Approvals** button is visible without horizontal scrolling.
- Tap it and confirm it lands on `/admin/team-approvals`.