## Show recipient emails in Email Analytics dialog

### Context
The "Email Analytics" dialog (`src/components/EmailAnalyticsDialog.tsx`) is the one opened from the UI. It currently shows campaign rows with a "Recipients" column displaying only a count (`campaign.recipient_count`). The admin `/admin/email-analytics` page already shows recipients — this change is about the dialog.

### File
`src/components/EmailAnalyticsDialog.tsx`

### Change
Replace the numeric "Recipients" cell with the actual recipient email address(es) for small sends, and fall back to the count for bulk:

- Fetch each campaign's recipients from `email_sends` (column already queried for `id`; extend to also select `recipient_email`).
- In the Recipients column:
  - If `recipient_count <= 5`: render the comma-joined recipient emails (truncated with tooltip).
  - If `recipient_count > 5`: render `{recipient_count}` as today (regular analytics view, no addresses).

### Implementation notes
- In `loadCampaigns`, change the `email_sends` select to `"id, recipient_email"` and store `recipients: string[]` on each campaign (only populate when `recipient_count <= 5` to avoid extra payload).
- Add `recipients?: string[]` to the `Campaign` interface.
- Column header stays "Recipients". Cell: `campaign.recipients?.length ? campaign.recipients.join(", ") : campaign.recipient_count`. Apply `max-w-[220px] truncate` with a `title={...}` for the full list on hover.

### Out of scope
- Admin email analytics page (already done).
- Open/click/rate columns, stats cards, queries, RLS, edge functions.
