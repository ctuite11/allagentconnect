# Agent Network: require activation

Apply only the activation gate migration from the Cursor commit, then verify counts. No record edits, no activations, no purges, no setup links, no emails.

## The change

`public.get_verified_agent_ids()` currently ends with:

```text
AND ( account_activated_at IS NOT NULL OR company <> '' )
```

The migration drops the `company` fallback so the final condition is just `account_activated_at IS NOT NULL`. Everything else (verified status, `hide_from_directory = false`, agent role, non-empty first/last name) stays exactly as is.

## Steps

1. Add `supabase/migrations/20260804090000_agent_network_require_activation.sql` containing a single `CREATE OR REPLACE FUNCTION public.get_verified_agent_ids()` that replays the live definition minus the `company` fallback. No `UPDATE`, `INSERT`, or `DELETE` statements, no changes to team tables, no queue writes.
2. Run the migration.
3. Run read-only verification queries:
   - Individual Agent Network count from `get_verified_agent_ids()` equals 202.
   - Count of verified, non-hidden, named agents with `account_activated_at IS NULL` still returned equals 0.
   - Activated agents with `headshot_url` null/empty are still returned (headshot is not part of the gate).
   - Approved team tiles: count and rows unchanged before/after.
   - `email_jobs` row count unchanged, and no agent rows modified (compare `agent_settings`/`agent_profiles` max `updated_at` and row counts before/after).
4. Report the numbers back. No frontend changes in this pass.

## Notes

- 89 agents visible today only through the `company` fallback will stop appearing. This is the intended effect; their records are untouched and they reappear automatically once activated.
- Teams render from a separate path and are unaffected by this function.
