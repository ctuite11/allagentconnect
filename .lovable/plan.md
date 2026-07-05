## Purge everything for doittuite14@yahoo.com

Target identity:
- Email: `doittuite14@yahoo.com`
- User ID: `444632a7-a702-4d53-be30-d081fe649a36`
- AAC ID: AAC-0194 (howie hill — bogus profile)
- Pending delegate invite from Chris Tuite (owner `1fc50da1-…`)

### Rows found

| Table | Rows |
|---|---|
| agent_profiles | 1 |
| user_roles | 1 |
| agent_settings | 1 |
| agent_account_members (delegate invite from Chris) | 1 |
| pending_verifications | 2 |
| agent_buyer_coverage_areas | 1 |
| email_jobs (queued/sent emails to this address) | 7 |
| profiles | 1 |
| auth.users | 1 |

No rows in: agent_early_access, agent_invites, agent_county_preferences, agent_state_preferences, agent_license_uploads, invite_events.

### Deletion order (single data-op)

1. `agent_buyer_coverage_areas` where `agent_id = 444632a7…`
2. `agent_settings` where `user_id = 444632a7…`
3. `user_roles` where `user_id = 444632a7…`
4. `agent_account_members` where `lower(invite_email) = 'doittuite14@yahoo.com'` (Chris's pending delegate invite)
5. `pending_verifications` where `lower(email) = 'doittuite14@yahoo.com'`
6. `email_jobs` where `lower(payload->>'to') = 'doittuite14@yahoo.com'`
7. `agent_profiles` where `id = 444632a7…`
8. `profiles` where `id = 444632a7…`
9. `auth.users` where `id = 444632a7…` (via `auth.admin.deleteUser`, since raw deletes on `auth.*` are not allowed)

### After purge — verification
Re-run the same 15-table count query; every row must be 0.

### Notes / caveats
- This will also **cancel Chris's pending delegate invite** to this email. He can re-invite afterward and it will land cleanly (no colliding standalone profile).
- 7 `email_jobs` rows will be removed — this wipes send history to that address. If you'd rather preserve audit trail, say so and I'll leave `email_jobs` intact.
- No listings, conversations, hot sheets, clients, or messages reference this user, so nothing else needs cascading.

Approve to run.
