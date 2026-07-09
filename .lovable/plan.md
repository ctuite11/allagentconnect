## What's going on

There are **two Frank Carroll agent_profiles rows** — the same duplicate pattern as Matt Munden:

| id (short) | email | company | headshot | profile_complete |
|---|---|---|---|---|
| `14367da3…` | frank.carroll@compass.**om** (typo) | — | — | **No** ❌ |
| `e9d00597…` | frank.carroll@compass.**com** (real) | Compass | ✅ | **Yes** ✅ |

The admin list computes `profile_complete` as: first_name + last_name + headshot_url + company + (phone or email). The typo-email row is missing company and headshot → shows "No". Both rows have their own `auth.users` account and their own `agent_settings` (both `verified`). There are also two `agent_early_access` rows, one per email.

Frank isn't seeing a bug — he has a real complete profile (`e9d00597…`). The admin list is showing *both* rows because they are two separate auth users, and the typo one is genuinely incomplete.

## Plan

Delete the typo-email duplicate `14367da3…` (email `frank.carroll@compass.om`) end-to-end, so the admin list only shows the real, complete Frank Carroll.

Deletions, in order (all via the insert tool as DELETEs — no schema changes):

1. `agent_early_access` where `id = e2700486-a8f2-4af5-b450-3ba63d574fb5` (the `.om` early-access row).
2. `agent_settings` where `user_id = 14367da3-3417-48c7-b0c2-aa0f67cb131f`.
3. `agent_profiles` where `id = 14367da3-3417-48c7-b0c2-aa0f67cb131f`.
4. Report back the `auth.users` row for that id — I cannot delete auth users from SQL. You'll need to remove it from the Auth users list, or I can call an admin edge function if one exists (I'll check `admin-delete-user` / similar before touching anything).

Not touching:
- The real profile `e9d00597…` and its settings, early-access, or auth user.
- Any other tables. If FK constraints block a delete, I'll pause and report which table still references the id — I won't cascade-delete blindly (messages, relationships, listings, etc. could hang off this uuid).

Same offer as before for Matt Munden's typo duplicate `3c9d908b…` — say the word and I'll clean that one up the same way in a follow-up.

### Technical notes

- The `profile_complete` logic lives in `supabase/functions/admin-list-agents/index.ts` — no code change needed; it will report correctly once the duplicate row is gone.
- Root cause of the duplicates is the early-access → auth conversion accepting typo emails as separate accounts. Hardening that is a separate task; this plan is data cleanup only.

**Confirm:** OK to delete the `frank.carroll@compass.om` (typo) profile, its settings, and its early-access row?