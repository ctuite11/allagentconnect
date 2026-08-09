# Delete greg gotti completely

## What the records show
- CRM buyer `greg gotti` (`tuite.alexandra16@gmail.cpom`) still exists as a client record under your account.
- His agent relationship was ended on Jun 28 and his invite token was revoked the same day — that is why he correctly does not appear in My Buyers.
- He has no hot sheets, no hot sheet memberships, and no messages. Only two leftover rows reference him: 1 ended relationship row and 1 revoked invite token.

## What will be done
Purge the leftover record so nothing can link to him anymore:
1. Delete the revoked invite token that points at his client id.
2. Delete the ended agent relationship row.
3. Delete the client record itself.

Nothing else is touched — no other buyers, no emails, no schema changes, no UI changes.

### Technical detail
Data-only deletes (in this order to respect foreign keys):
- `share_tokens` where `payload->>'client_id' = 'e48b3b67-7752-454d-bd2d-327b3b930a8a'`
- `client_agent_relationships` where `crm_client_id = 'e48b3b67-...'`
- `clients` where `id = 'e48b3b67-...'`

Before/after counts will be reported.
