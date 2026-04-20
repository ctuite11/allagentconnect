
## Re-verify zero trace of `chris.tuite@compass.com`

You're asking me to confirm with certainty. I cannot run queries in plan mode — but the moment you approve, I'll run a single comprehensive read-only audit across every table that could possibly hold this email.

### Verification sweep

One read-only SQL pass across all known surfaces:

| Surface | Check |
|---|---|
| `auth.users` | email match (case-insensitive) |
| `public.profiles` | email match |
| `public.clients` | email match |
| `public.client_agent_relationships` | client_id / crm_client_id IN any resolved IDs |
| `public.agent_invites` | invitee_email match |
| `public.share_tokens` | payload `client_email` / `to` / `email` match, plus `accepted_by_user_id` |
| `public.hot_sheet_clients` | client_id IN resolved CRM IDs |
| `public.hot_sheet_comments` | sender_id IN resolved user IDs |
| `public.hot_sheets` | user_id IN resolved user IDs (buyer-owned) |
| `public.email_jobs` | payload `to` match |
| `public.user_roles` | user_id match |
| `public.favorites` / `buyer_qualifications` / `buyer_credentials` / `notification_preferences` | user_id match |
| `public.conversation_participants` / `conversation_messages` | user/sender/recipient IDs |
| `public.buyer_workspaces` / `_members` / `_invites` | owner / user / invitee email |
| `public.audit_logs` | user_id match |
| `public.listing_status_history` | changed_by match |
| `public.agent_profiles` | email match (in case of agent-side record) |
| `public.leads` / early-access tables | email match |

### Expected output

A single table:
```
table_name              | rows
------------------------+-----
(every surface)         |   0
```

If any row appears, I'll show you exactly which table, which row, and immediately purge it with a follow-up `DELETE`.

### Scope guardrails

- **Read-only first** — no deletes unless residue is found.
- No schema changes, no other users touched.
- If everything returns 0, I'll confirm: **"100% clean — zero trace remaining."**
