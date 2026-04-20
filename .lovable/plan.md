
## Clean up `agent_invites` rows for chris.tuite@compass.com

The previous cleanup pass purged CRM contacts, relationships, share tokens, and hot-sheet links — but **did not** touch `public.agent_invites` (the table that powers the "Invite agents" flow from `InviteAgentDialog.tsx`).

That's why `chris.tuite@compass.com` still appears under **Cloud → agent_invites**.

### What I'll do

1. **Audit** `public.agent_invites` for any row where `invitee_email = 'chris.tuite@compass.com'` (case-insensitive) — confirm count and inspect `inviter_user_id`, `created_at`, status fields.
2. **Delete** all matching rows via the data tool (this is a `DELETE`, so it goes through the insert/update tool, not a migration).
3. **Verify** the table is clean by re-running the count query.

### Scope guardrails (per project rules)

- Only `public.agent_invites` is touched.
- No schema changes, no migration file.
- Profile, `user_roles`, `email_jobs` history, and auth user remain intact (consistent with the prior cleanup pass).
- No frontend changes.

### Why this isn't a duplicate-prevention concern

The unique index added in the last pass (`clients_agent_email_unique`) protects the **CRM contacts** table. `agent_invites` is a separate "agent recruits another agent to AAC" table and is allowed to have repeated invite attempts — so we just clean the test rows, no constraint needed.

### Confirmation expected after run

```
agent_invites rows for chris.tuite@compass.com: 0
```
