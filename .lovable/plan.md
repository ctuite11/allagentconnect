## Reframed — One Active Agent Per Buyer

You're right. Active = buyer accepted invite + created account, and only **one** agent can hold an active relationship with a buyer at a time. That changes the diagnosis.

### Database reality for `tuite.chris11@gmail.com`

Auth/profile: `cddd17b4-c345-45f3-a3b6-9a3b19a5c5f8` (account exists).

`client_agent_relationships` rows:

| Agent | `status` | `client_id` (auth) | `crm_client_id` | Created |
|---|---|---|---|---|
| `1fc50da1` (Chris) | `active` | `cddd17b4` ✓ | `958b0d93` | 2026-06-04 — invite accepted, account exists |
| `ea18faa4` (the one showing "Pending") | `pending` | `NULL` | `aa67f895` | 2026-06-08 02:53 — added tonight, invite NEVER accepted |

So:

1. Agent `1fc50da1` — correctly **Active**.
2. Agent `ea18faa4` — should never have been allowed to add this buyer. The duplicate-registration guard didn't fire. The "Pending" badge is technically truthful for that bad row, but the row itself shouldn't exist.

### Why the guard missed it

The duplicate check almost certainly matches on `clients.email + agent_id` (CRM scope) rather than asking "does this email already have an active relationship with ANY other agent?". `aa67f895` and `958b0d93` are two **different `clients` rows** owned by two different agents, both with email `tuite.chris11@gmail.com`, so a per-agent uniqueness check sees no conflict.

### Plan

#### 1. Enforce one-active-agent at the source
New migration adds a server-side check (function + trigger on `client_agent_relationships` BEFORE INSERT/UPDATE):
- When a row would become `status IN ('active','pending')` with `ended_at IS NULL`,
- AND another `client_agent_relationships` row already exists with `status='active'`, `ended_at IS NULL`, and either matching `client_id` (auth user) OR matching email via `crm_client_id → clients.email`,
- AND that other row's `agent_id` is different,
- → raise `RAISE EXCEPTION 'BUYER_ALREADY_REPRESENTED'` with the existing agent id in the message.

Partial unique index as belt-and-suspenders on `(client_id) WHERE status='active' AND ended_at IS NULL` (only enforceable on auth-linked rows; the trigger handles the email-only case).

#### 2. Surface the guard in the UI when adding a contact
Wherever a CRM contact is created (Add Buyer in `/my-clients`, "Create Hot Sheet" buyer step, invite flows), catch the `BUYER_ALREADY_REPRESENTED` error and show a clear alert: "This buyer is already represented by another agent." Do NOT create the `clients` row or the pending relationship.

The pre-insert lookup should also query existing relationships by email (across all agents), not just the agent's own contacts, so the alert appears before the user submits.

#### 3. Clean up the stale pending row for `tuite.chris11`
One-off update in a migration: mark relationship `b018f0cf-ac16-403f-9a64-f149a560b1b4` (and its corresponding share_token `d9236042`) as ended/revoked, and either delete the orphan `clients.aa67f895` row or flag it so it stops appearing in My Buyers for agent `ea18faa4`.

#### 4. Backfill scan
Same migration: find every other `clients` row whose email matches a buyer with an active relationship under a different agent. List them in a new `audit_logs` entry for review, then end any pending duplicate relationships the same way.

#### 5. No change to the badge logic
With the trigger + cleanup in place, `useSuccessHubData.ts` line 436 stays as-is: it reports "Pending" only when an agent has a legitimate pending invite to a buyer who *doesn't* already belong to another agent. The 1fc50da1 ↔ tuite.chris11 row is already Active and will keep displaying Active.

### Out of scope
- No UI redesign.
- No change to invite emails or share-token format.
- No change to ended-relationship handling, hot-sheet membership, or messaging.

Reply **go** and I'll implement steps 1–4 in one migration plus the matching client-side error handling for Add Buyer / Create Hot Sheet.