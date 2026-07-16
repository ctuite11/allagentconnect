## Findings

Dara has two auth accounts:

| Email | auth.users.id | agent_profiles | Status |
|---|---|---|---|
| `dara.cipollone@resisrealestate.com` (correct) | `8c2b3945-eed5-4880-82db-659802d72721` | present, id matches | **Keep — active account** |
| `dara.cipollone@resisrealestste.com` (typo "realestste") | `adf9c48e-0831-4c14-b8e4-f9717d888112` | gone (archived under a different id `30913cec…` in `deleted_users`) | **Orphan auth row — needs cleanup** |

Same class of bug we fixed for Yanis: the archived `agent_profiles.id` didn't match `auth.users.id`, so `delete-users` couldn't remove the auth row and returned "unsuccessful", even though the DB profile is already gone.

## Fix

One-line data migration:

```sql
DELETE FROM auth.users
WHERE id = 'adf9c48e-0831-4c14-b8e4-f9717d888112'
  AND email = 'dara.cipollone@resisrealestste.com';
```

The good account (`…@resisrealestate.com`) is untouched.

## Verify

Re-query `auth.users` / `agent_profiles` for `%cipollone%` → only the correct-spelling row remains.
