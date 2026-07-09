# Send Test Profile Reminder Email

Send the newly-added "Complete Your Profile — Reminder" template to your admin email so you can review it in your inbox.

## Option A — Send via the app (recommended, no code changes)

1. Open **Admin → Approvals → Email Agents** dialog.
2. In the template dropdown, select **"Complete Your Profile — Reminder"** — Subject and Message auto-fill.
3. In the recipient list, select only your own admin agent record.
4. Click Send.

The bulk-send function auto-prepends `Hello {first_name},` per recipient, so your inbox copy will read `Hello {your first name},` followed by the reminder body, then `Best, Chris / All Agent Connect`.

## Option B — I send it server-side to a specific address

If you'd rather not go through the UI, reply with the email address you want it delivered to. I'll invoke the existing `send-bulk-email` edge function once with that single recipient using the template's subject and body. No code changes, no template changes.

## Out of scope

- No new edge function, no new React Email template, no styling changes. This is purely a delivery test of the plain-text template that was just added to the dropdown.

Approve this plan and tell me which option (A or B, and the address if B) you'd like.