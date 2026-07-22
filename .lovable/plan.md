## Goal

Make it easy to find verified-but-not-activated agents who are overdue for another reminder, directly in **Admin Approvals** — no CSV required.

## What you'll see

A new **Last Reminder** column between **Verified On** and **Activated**:

- Absolute date (e.g. `Jul 19, 2026`) + relative label underneath (`3 days ago`, `today`, `Never`)
- Tooltip shows: template name (`license-verified` / `agent-invite` / `agent-missing-opportunities`) and delivery status (`delivered`, `sent`, `bounced`, etc.)
- Sortable header — clicking it sorts oldest-reminder-first so stale agents float to the top
- Empty state = `Never` in muted zinc, and sorts as "oldest" (highest priority for a fresh reminder)

## Implementation (technical)

File: `src/pages/AdminApprovals.tsx`

1. **Fetch**: extend the existing `email_jobs` enrichment (lines ~589–640) to also include the `agent-missing-opportunities` template — currently only `license-verified` and `agent-invite` are loaded. Add a third map `reminderByEmail` that keeps the newest send across all three templates per email, storing `{ sent_at, template, status }`.

2. **Type**: add `last_reminder?: { sent_at: string; template: string; status: string } | null` to the `Agent` type and populate it in the `enriched` map (line ~663).

3. **Column**: insert a new `<th>` with `handleSort("last_reminder")` and matching `<td>` in the table (after the Verified On cell, before Activated). Cell renders the date + relative label using the same pattern as the Verified On cell.

4. **Sort**: extend the `handleSort` / sort comparator to support `last_reminder`, ordering by `sent_at` ascending with `null` first (so "Never" rises to the top).

5. **Drawer**: no changes — `AgentDetailsDrawer` already shows the reminder history section.

No schema changes, no edge function changes, no new queries — reuses the enrichment already loaded on page open.

## Out of scope

- CSV export (already covered by "Export activation audit")
- Auto-sending overdue reminders
- Any change to the reminder emails themselves
