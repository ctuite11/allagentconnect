
## Fully purge `chris.tuite@compass.com` from production

Wipe every record tied to this email across CRM, auth, workspace, messaging, and audit tables — leaving zero trace.

### Current known footprint

From prior audits, the email `chris.tuite@compass.com` may still touch:
- `public.profiles` (auth-linked profile, may have been re-created)
- `auth.users` (auth account, if still present)
- `public.clients` (CRM contact `fd82b78e-804e-42f3-9b13-ad0d15228536` + any others)
- `public.client_agent_relationships`
- `public.share_tokens` (payload-embedded email)
- `public.hot_sheet_clients` / `public.hot_sheets`
- `public.hot_sheet_comments` (sender_id)
- `public.email_jobs` (recipient history)
- `public.user_roles`
- `public.favorites`, `buyer_qualifications`, `buyer_credentials`, `notification_preferences`
- `public.conversation_participants` / `conversation_messages`
- `public.buyer_workspaces` / `buyer_workspace_members` / `buyer_workspace_invites`
- `public.agent_invites` (already cleared, will re-verify)
- `public.audit_logs`
- `public.listing_status_history.changed_by`

### Execution plan

**Step 1 — Full audit (read-only)**
Resolve every `user_id` and `client_id` for the email across both `auth.users` and `public.profiles` + `public.clients`. Print exact counts per table so we have a before/after diff.

**Step 2 — Cleanup (data-only, via insert/update tool — no schema migration)**
Delete in FK-safe order:
1. `email_jobs` where payload `to` = email
2. `share_tokens` where payload email matches OR `accepted_by_user_id` in resolved user IDs (SET NULL on `accepted_by_user_id` first, then DELETE rows owned by user)
3. `hot_sheet_comments` (sender_id)
4. `hot_sheet_clients` (client_id IN resolved CRM ids)
5. `hot_sheets` owned by the user (if any — buyer-created)
6. `conversation_messages` where sender/recipient is the user → then `conversation_participants` → then orphan `conversations`
7. `buyer_workspace_invites` (accepted_by_user_id SET NULL, then DELETE invitee rows)
8. `buyer_workspace_members` → `buyer_workspaces` owned by user
9. `favorites`, `favorite_price_history` (via listing chain N/A — only their own rows)
10. `buyer_qualifications`, `buyer_credentials`, `notification_preferences`
11. `client_agent_relationships` (both `client_id` and `crm_client_id` references)
12. `clients` (CRM rows by email)
13. `user_roles`
14. `audit_logs` (user_id)
15. `listing_status_history` SET NULL on `changed_by`
16. `agent_invites` (re-verify, by `invitee_email`)
17. `profiles`
18. `auth.users` — final auth account deletion via the existing `delete-users` edge function (already FK-aware) using `{ emails: ["chris.tuite@compass.com"] }`

**Step 3 — Verify clean**
Re-run the Step 1 audit. Expected output:
```
profiles: 0 | auth.users: 0 | clients: 0 | relationships: 0
share_tokens: 0 | hot_sheet_*: 0 | email_jobs: 0
buyer_workspace_*: 0 | conversation_*: 0 | user_roles: 0
agent_invites: 0 | audit_logs: 0
```

### Scope guardrails

- **No schema changes** — pure data deletion.
- **No frontend changes.**
- **No other users touched** — every query scoped by resolved user/client IDs or email.
- `listings` owned by other agents are untouched (only `listing_status_history.changed_by` is nulled).
- The existing `delete-users` edge function handles the final `auth.users` removal with FK clearing as a safety net.

### Why this is irreversible

This wipes audit trail, email history, and the auth account. After this, re-inviting `chris.tuite@compass.com` will create a fully fresh user with no prior state. Confirm before running.
