## Goal

Sending an email to a single buyer (Buyer Account, Client Dashboard, etc.) should:
- enqueue **one** row in `email_jobs`
- render through the AAC Unified template
- invoke `kick-email-queue` to process immediately
- never touch `send-bulk-email`, marketing tracking, or the bulk modal

## Approach

### 1. New edge function `send-agent-client-email`

Mirrors `send-buyer-agent-email` / `send-client-agent-message` but reversed (agent → one client).

Behavior:
- Authenticate caller via JWT, confirm caller is the agent.
- Validate body: `{ clientId? | recipientEmail, subject, message, replyToSelf? }`.
- Resolve agent (sender) name + email from `agent_profiles` → fallback `profiles`.
- Resolve recipient email (from `crm_clients` / `profiles` if `clientId` given, else use validated `recipientEmail`).
- Insert one row into `email_jobs` with:
  ```
  payload: {
    provider: "resend",
    template: "agent-client-message",   // new case in renderEmailTemplate
    to: recipientEmail,
    subject: trimmedSubject,
    variables: {
      clientName, agentName, agentEmail, agentPhone,
      subject, message
    },
    reply_to: agentEmail
  }
  ```
  No `category` field → no tracking pixel / unsubscribe injection (transactional only).
- After insert, `supabase.functions.invoke("kick-email-queue", {})` (best-effort; cron also picks it up).
- Return `{ success, jobId }`.

### 2. Add `agent-client-message` template case in `_shared/renderEmailTemplate.ts`

AAC Unified (`buildAacEmail`) with:
- headline: subject
- body: personal-message block + agent contact block (reuse existing helpers)
- no marketing footer

### 3. New lightweight UI component `SingleClientEmailDialog`

Same look as current minimalist dialog (Subject + Message, char count, Send button). On submit calls `supabase.functions.invoke("send-agent-client-email", { body: { clientId, recipientEmail, subject, message } })`.

### 4. Swap call sites

Replace `BulkEmailDialog` usage with `SingleClientEmailDialog` in:
- `src/pages/success-hub/BuyerAccount.tsx`
- `src/components/buyer/ClientDashboardView.tsx`

Leave `BulkEmailDialog` and `send-bulk-email` intact for `MyClients` multi-select use case.

### 5. Verification

- Trigger send from `/agent/buyers/:id` Buyer Account → confirm one new `email_jobs` row, `email_events` shows `processing_started` then `sent`, recipient inbox receives AAC Unified email, no `send-bulk-email` invocation in network log.

## Files

- new: `supabase/functions/send-agent-client-email/index.ts`
- edit: `supabase/functions/_shared/renderEmailTemplate.ts` (add case)
- new: `src/components/SingleClientEmailDialog.tsx`
- edit: `src/pages/success-hub/BuyerAccount.tsx`
- edit: `src/components/buyer/ClientDashboardView.tsx`

No DB migration required (uses existing `email_jobs` queue).
