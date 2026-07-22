## Context

Josh Stiles' team request exists in `public.teams` as `Stiles Team` (`status=pending`, created 2026-07-22 13:11 UTC). The approvals UI lives at `/admin/team-approvals` (`src/pages/AdminTeamApprovals.tsx`) and works — but there is no link to it from the main Admin Approvals page, so admins have no way to reach it from the nav.

The zero-count on the Pending tab is a separate concern; on this turn we're only adding the entry point per your instruction.

## Change

In `src/pages/AdminApprovals.tsx` header actions row, add a **"Team Approvals"** button (outline, `Users` icon) that navigates to `/admin/team-approvals`. Show a small count badge next to the label when there are pending teams.

- Fetch pending count once on mount:
  ```ts
  supabase.from("teams").select("id", { count: "exact", head: true }).eq("status", "pending")
  ```
- Badge only renders when `count > 0`.
- Button sits alongside the existing Export / Preview email actions in the header toolbar so it's discoverable without disturbing the current layout.

No other files change. No schema changes.

## Verify

1. Load `/admin/approvals` as admin → see **Team Approvals · 1** button.
2. Click → lands on `/admin/team-approvals`; Stiles Team is visible in Pending; Approve / Reject work as today.
3. After approving, return to `/admin/approvals` → badge disappears on reload.
