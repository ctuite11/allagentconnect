# Simplify to one "Last Email" column in Admin → Approvals

## Goal
Replace the two confusing columns ("Last Reminder" and "Last Activation Reminder") with a single, plain column that answers one question: what was the last email we sent this agent, and when.

## What the column shows
- The friendly name of the most recent email of **any** type sent to that agent (not just reminders) — e.g. "License Verified", "Invitation", "Don't miss opportunities", "Temporary password", etc.
- The date, plus a short relative age ("today", "3 days ago").
- Hovering shows the exact time, the delivery status (sent / delivered / bounced / failed), and the raw template name.
- "Never" when no email is on record.
- Sorting by this column keeps "Never" at the bottom in both directions.

Full per-agent email history stays available in the agent's detail panel, so nothing is lost.

## Technical changes

### Backend — `supabase/functions/admin-list-agents/index.ts`
- Replace `last_reminder` / `last_activation_reminder` with a single `last_email: { sent_at, template, status } | null`.
- Drop the reminder-template allow-list: take the newest `email_jobs` row per recipient regardless of template (jobs are already fetched newest-first).
- Note: the existing `email_jobs` fetch is currently filtered to a template list — widen it to all templates for that recipient set, still capped/ordered as today.
- Redeploy the function.

### Frontend — `src/pages/AdminApprovals.tsx`
- Remove both reminder columns, headers, sort cases, and interface fields.
- Add one sortable "Last Email" column rendering the label + relative age with the tooltip described above.
- Add a small template-key → friendly-label map for display; unknown templates fall back to the raw key.

### Frontend — `src/components/admin/AgentDetailsDrawer.tsx`
- Replace the two lifecycle rows with a single "Last Email" row using the same label and formatting.

## Out of scope
- No emails sent, no schema changes, no changes to what triggers any email.
