

# Full Wipe of tuite.chris@gmail.com

Delete every record associated with this email so you can start completely fresh — new client, new invite, new everything.

## Records to Delete (in order)

1. **hot_sheet_clients** — 2 rows linking the client to hot sheets "test" and "test3"
2. **share_tokens** — 3 invite tokens referencing `tuite.chris@gmail.com`
3. **clients** — 1 CRM record (`e277c72d-5bd2-46ec-86d3-93ace2aeca88`)

The auth user and profile were already removed in the previous cleanup.

## SQL (executed in dependency order)

```sql
-- 1. Remove hot sheet links
DELETE FROM hot_sheet_clients
WHERE client_id = 'e277c72d-5bd2-46ec-86d3-93ace2aeca88';

-- 2. Remove invite tokens
DELETE FROM share_tokens
WHERE payload->>'client_email' = 'tuite.chris@gmail.com';

-- 3. Remove the client record
DELETE FROM clients
WHERE id = 'e277c72d-5bd2-46ec-86d3-93ace2aeca88';
```

## After This

- Zero traces of `tuite.chris@gmail.com` in the database
- You can re-add the client from scratch in My Contacts, create a new hot sheet, and send a fresh invite

