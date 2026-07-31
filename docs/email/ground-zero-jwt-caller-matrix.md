# Ground Zero JWT / caller matrix

**Status:** Inventory for review — do **not** deploy.  
**Branch:** `cursor/email-ground-zero-hardening`  
**Pause posture:** `EMAIL_SENDING_PAUSED=true`; all DB stream pauses initialize `true`.

## Protected functions (`verify_jwt = true` + in-function authority)

| Function | Authority model | Legitimate caller(s) | Proof |
|---|---|---|---|
| `process-email-queue` | service_role / admin / `EMAIL_CRON_SECRET`+service | Supabase cron / admin ops | Caller must send `Authorization: Bearer <service_role>` |
| `kick-email-queue` | service_role / admin / cron | Edge producers with service key; admin UI | Producers already pass service bearer (e.g. `send-welcome-email`, `submit-agent-verification-request`) |
| `send-new-match-notification` | privileged (service/admin) | `notify-matching-buyers` via service-role `functions.invoke` | Service client attaches service JWT |
| `notify-agents-client-need` | privileged | DB `notify_agents_of_client_need` `net.http_post` with service_role bearer | Migration SQL Authorization header |
| `notify-agents-new-listing` | privileged (stub) | Stray callers only | Returns `{ disabled: true }`; no enqueue |
| `send-bulk-email` | privileged | Admin / service bulk tools | Admin JWT or service role |
| `process-comms-digests` | privileged | Internal cron / admin | Must use service bearer (cron inactive in prod until approved) |
| `dry-run-hot-sheet-listing` | gateway JWT | Admin tooling | No enqueue path |
| `dry-run-comms-broadcast` | gateway JWT | Admin tooling | No enqueue path |
| `process-hot-sheet` | gateway JWT (user or service) | Agent UI baseline/manual; `accept-client-hot-sheet-invite` service invoke; Add Friend baseline | Owner RLS for user JWT; service for invite |
| `send-hot-sheet-preview-blast` | gateway JWT | Admin | Already admin-gated historically |

## Callers intentionally rejected

| Caller | Target | Result | Notes |
|---|---|---|---|
| Anonymous | Any worker/privileged producer | 401 | Fail closed |
| Ordinary / pending agent JWT | `process-email-queue`, `kick-email-queue`, privileged producers | 401/403 | Fail closed |
| `useConversation` client kick | `kick-email-queue` | **Removed** | Ordinary user JWT must not drain queue |

## Remaining pre-deploy proof (non-production)

```text
[ ] Invoke process-email-queue with service_role → 200 / paused (0 sent)
[ ] Invoke process-email-queue with anon → 401
[ ] Invoke kick-email-queue with ordinary user JWT → 403
[ ] Invoke kick-email-queue with service_role → 200 / paused
[ ] notify-matching-buyers → send-new-match-notification (service) → auth PASS, pause gate
[ ] DB trigger notify-agents-client-need with service bearer → auth PASS, pause gate
[ ] process-comms-digests with service bearer → auth PASS, pause gate
[ ] process-comms-digests with anon → 401
```

Do not run these against production. Do not unpause. Do not enable crons.
