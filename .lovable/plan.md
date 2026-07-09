## What's going on

Same duplicate pattern as Frank Carroll / Matt Munden — there are **two Anh Nguyen agent_profiles rows**:

| id (short) | email | company | headshot | profile_complete |
|---|---|---|---|---|
| `1b251e58…` | anh@serhant.**con** (typo) | — | — | **No** ❌ |
| `a660e100…` | a.ngocn10@gmail.com | SERHANT. | ✅ | **Yes** ✅ |

The typo-email row is the one showing "No". The real, complete profile is under `a.ngocn10@gmail.com`.

(There's also a separate row for **Alan** Nguyen — different person, incomplete profile with no company/headshot. Leaving that alone unless you say otherwise.)

## Plan

Delete the typo duplicate `1b251e58…` end-to-end via the insert tool (DELETEs):

1. `agent_early_access` where `id = 9b6d68e6-6942-4206-9552-b3674a3929e8` (the `anh@serhant.con` row).
2. `agent_settings` where `user_id = 1b251e58-7ce7-4e77-8e8d-a53ff3d1ecde`.
3. `agent_profiles` where `id = 1b251e58-7ce7-4e77-8e8d-a53ff3d1ecde`.
4. Report the leftover `auth.users` row for that id (SQL can't delete auth users).

Not touching: the real profile `a660e100…`, Alan Nguyen, or any other tables. If an FK blocks a delete I'll pause and report which table still references it.

**Confirm** OK to delete the `anh@serhant.con` typo duplicate?