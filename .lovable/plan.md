## Add Email History to Agent Details Drawer

New admin-only diagnostic section below "Activation Reminder Details" showing every License Verified / Activation Reminder email sent to the agent, with delivery + tracking data.

### Data available (verified against schema)

Per email_jobs row where `payload->>'template' = 'license-verified'` and `payload->>'to' = agent.email`:

| Requested field | Source |
|---|---|
| Sent date/time | `email_jobs.created_at` (queued), `delivery_status_at` (delivered) |
| From address | Constant `All Agent Connect <hello@allagentconnect.com>` (verified in `send-license-verified-email` + `email.sent` events) |
| Reply-To | `payload->>'reply_to'` (verified: `chris@allagentconnect.com`) |
| Template name | `payload->>'template'` |
| Delivery status | `delivery_status` + `status` (Queued / Sent / Delivered / Bounced / Failed) |
| Opened | `email_job_opens WHERE job_id = job.id` (count + first opened_at) |
| Clicked | `email_job_clicks WHERE job_id = job.id` (count + first clicked_at + URL) |
| Provider message ID | `email_jobs.provider_message_id` |
| Idempotency key | `email_jobs.idempotency_key` |
| Recovery/setup link generation time | `email_jobs.created_at` (link is minted in the same request that enqueues the email — no separate timestamp exists; label it accordingly) |
| Error / bounce reason | `email_jobs.last_error` + `email_events` rows where `event IN ('bounced','failed','complained')` reading `detail->raw->data` |

### Backend: new edge function

`supabase/functions/admin-list-agent-emails/index.ts` (mirrors `admin-list-agents` gate):

- Admin-gated: verify caller JWT via `auth.getUser`, then `has_role('admin')`.
- Input body: `{ email: string, templates?: string[] }` (default templates: `['license-verified']`, extensible later).
- Query: last 25 `email_jobs` for that recipient + template, plus related `email_events`, `email_job_opens`, `email_job_clicks` joined by `job_id`.
- Returns compact JSON: `{ jobs: Array<{ id, created_at, status, delivery_status, delivery_status_at, provider_message_id, idempotency_key, last_error, from, reply_to, subject, template, opens: Array<{opened_at}>, clicks: Array<{clicked_at, url}>, events: Array<{event, provider_event_at, detail}> }> }`.
- Never logs recipient PII or setup URLs.

No schema/RLS changes — email_jobs and email_events have RLS on with no policies today, and the edge function reads them via the service role, keeping the surface admin-only.

### Frontend: new drawer subcomponent

`src/components/admin/AgentEmailHistory.tsx`:

- Fetches on mount for the current agent's email via `supabase.functions.invoke('admin-list-agent-emails')`.
- Loading / empty / error states.
- Renders newest-first list. Each item:
  - **Summary row:** sent timestamp • delivery pill (color-coded Delivered/Sent/Bounced/Failed/Queued) • Opened chip (green if opens > 0) • Clicked chip (blue if clicks > 0).
  - **Expandable (`<details>`) block:** From, Reply-To, Template, Subject, Provider message ID (monospaced, copyable), Idempotency key, Link generated at (= job created_at, with clarifying tooltip that link + email are minted in one request), Error/bounce reason (from `last_error` or the latest `bounced`/`failed` event's `raw.data.reason`/`text`), and a compact delivery-event timeline (`processing_started → sent → delivered/bounced`).

### Drawer integration

`src/components/admin/AgentDetailsDrawer.tsx`:

- Below the "Activation Reminder Details" section add:
  ```
  <section>
    <h4>Email History</h4>
    <AgentEmailHistory email={agent.email} />
  </section>
  ```

### Not included / out of scope

- No email template changes.
- No changes to the send flow, throttle, guard, or link-generation logic.
- No new columns, no schema migration, no cron.
- Opens/clicks tracking coverage isn't added — we only display whatever `email_job_opens` / `email_job_clicks` already contain.

### Verification

1. Open drawer for an agent who recently received a License Verified email → history section shows one item with Sent → Delivered timeline and correct From/Reply-To.
2. Expand item → shows provider message ID, idempotency key, link-generated timestamp.
3. Agent with a bounced test event → status pill shows Bounced and expanded block shows bounce reason from the event detail.
4. Agent with no such emails → "No License Verified emails sent" empty state.
5. Non-admin caller of the edge function → 403.