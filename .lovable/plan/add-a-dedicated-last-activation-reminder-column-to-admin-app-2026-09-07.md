# Add a dedicated “Last Activation Reminder” column to Admin Approvals

## Goal
Give admins a clear, standalone way to see when each verified agent last received an **activation reminder**, separate from the broader “Last Reminder” column that mixes invitation and lifecycle emails.

## What counts as an activation reminder
Only emails whose purpose is to nudge/prompt account activation:
- `agent-missing-opportunities` — the “Don’t miss opportunities” campaign

The existing `last_reminder` field will continue to track `license-verified`, `agent-invite`, and `agent-missing-opportunities` unchanged.

## Changes

### Backend
- **File:** `supabase/functions/admin-list-agents/index.ts`
  - Add a new `last_activation_reminder?: { sent_at: string; template: string; status: string } | null` field to `MergedAgent`.
  - While scanning `email_jobs`, build a second map `latestActivationReminder` filtered to the `agent-missing-opportunities` template only.
  - Attach the result to each agent, just like `last_reminder`.

### Frontend
- **File:** `src/pages/AdminApprovals.tsx`
  - Add `last_activation_reminder` to the `Agent` interface.
  - Add a sortable column header **“Last Activation Reminder”** next to the existing **“Last Reminder”** column.
  - Render the date and relative age (today / N days ago), with a tooltip showing template + status + exact timestamp, matching the existing Last Reminder UX.
  - Add a `case "last_activation_reminder"` to the sorting logic.

- **File:** `src/components/admin/AgentDetailsDrawer.tsx`
  - Add `last_activation_reminder` to the `AgentDetailsAgent` interface.
  - Surface the value in the Lifecycle / Email section so the drawer is consistent with the table.

### Deployment
- Redeploy the `admin-list-agents` Edge Function.
- No database schema changes are required; this only surfaces existing `email_jobs` data.

## Out of scope
- No changes to what triggers the `agent-missing-opportunities` email.
- No changes to `last_reminder` behavior.
- No new templates or email sends.
