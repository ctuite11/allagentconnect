# Agent Network: require activation (both functions)

## Blocker: the Cursor commit is not reachable here

`6a675cec3fc69e79ca78e004a4724ccbcbd83725` is not in this workspace's git object store, and `supabase/migrations/20260804090000_agent_network_require_activation.sql` does not exist on disk. I cannot fetch a Cursor-side commit from this environment, so I cannot apply "that exact file unchanged" without its contents.

Two ways forward — pick one:

- **A (preferred, matches your instruction):** paste the full contents of the migration file into chat. I apply it verbatim, no edits.
- **B:** authorize applying the reconstruction below, which redefines both functions off their live definitions with only the `company` fallback removed.

Everything after this point assumes the SQL applied redefines both functions and nothing else.

## What the migration must do

Both functions today end with:

```text
AND ( account_activated_at IS NOT NULL OR btrim(coalesce(company,'')) <> '' )
```

Both must become:

```text
AND account_activated_at IS NOT NULL
```

`public.get_verified_agent_ids()` and `public.get_newest_verified_agents(int)` — all other predicates, the ordering, and the limit clause stay byte-identical.

## Pre-apply snapshot (read-only)

Recorded before anything runs:

- `get_verified_agent_ids()` count
- Approved team count and the full ID list
- `email_jobs` row count
- `agent_settings` row count and `max(updated_at)`
- `agent_profiles` row count and `max(updated_at)`

## Apply

Run the migration only. It contains no `INSERT` / `UPDATE` / `DELETE`, touches no team tables, writes nothing to queues, and changes no frontend, Comms Center, or Hot Sheet code.

## Post-apply verification (read-only)

- `get_verified_agent_ids()` count is 202
- Zero returned agents have `account_activated_at IS NULL`
- Activated agents with a null/empty `headshot_url` are still returned
- `get_newest_verified_agents(1000)` returns no unactivated agents
- The 89 company-fallback agents appear in neither function's output
- Approved team count and IDs identical to the snapshot
- `email_jobs`, `agent_settings`, `agent_profiles` counts and `max(updated_at)` identical to the snapshot

I report all numbers back; nothing else changes.
