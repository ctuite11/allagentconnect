## Goal
Purge the contacts you created via your initial CSV uploads on `chris@allagentconnect.com`, and leave your one-off/manually-added contacts intact.

## What the data shows
All 14,400 contacts on your account are stored with `source = 'manual'`, so we can't filter by source. But three clear bulk-import spikes account for essentially all of them:

| Import minute (UTC) | Rows |
|---|---|
| 2026-05-27 03:36 | 1,125 |
| 2026-05-28 22:25 | 11,381 |
| 2026-05-30 16:54 | 1,872 |
| **Total** | **14,378** |

The remaining ~22 rows are singletons scattered across later dates — those look like real one-at-a-time adds and will be kept.

## Plan
1. Delete every `public.clients` row where `agent_id = <chris user id>` AND `created_at` falls inside any of the three import-minute windows above (`[minute, minute + 1 minute)`).
2. Cascades / related cleanup: `clients` FK relationships (hot_sheet_clients, client_agent_relationships, client_agent_messages, hot_sheet_favorites, etc.) will drop with the client rows via existing `ON DELETE CASCADE`. No separate purge needed.
3. Report back the deleted count and the survivor count so you can confirm before adding anything new.

## Not in scope
- No schema changes.
- No changes to other agents' data.
- No touching invites, hot sheets, or messages that aren't tied to the deleted client rows.

## Confirmation needed
Reply "approve" and I'll run the delete. If you'd rather I also nuke the ~22 leftover singletons (true full reset), say "purge all" instead.