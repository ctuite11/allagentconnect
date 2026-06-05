## Plan

Reassign the most recently created listing to Austyn Agent.

- Listing: `350 North Street, Boston, MA` (id `b8e7e560-0c59-4e02-9340-61ecc2ad2c63`, created 2026-06-05)
- Currently assigned agent_id: `1fc50da1-2664-4931-8cab-64e24dc5ed8c`
- New agent: Austyn Agent (`ea18faa4-700f-4143-8c8e-436795a623af`, mymassagent11@gmail.com)

### Change
Run a single data update:

```sql
UPDATE public.listings
SET agent_id = 'ea18faa4-700f-4143-8c8e-436795a623af'
WHERE id = 'b8e7e560-0c59-4e02-9340-61ecc2ad2c63';
```

No schema, code, or RLS changes. Confirm and I'll apply it.
