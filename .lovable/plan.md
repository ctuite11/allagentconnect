## What's going on

There are two `agent_profiles` rows for Matt Munden:

| id (short) | email | first_name | last_name |
|---|---|---|---|
| `3c9d908b…` | matt.munden@**compss**.com (typo) | Matt | **Munden** ✅ |
| `b13407d8…` | matt.munden@**compass**.com (correct) | Matt | **matt.munden@compass.com** ❌ |

Your admin edit landed on the typo-email row (compss.com). The correct-email row (compass.com) is the one showing in the admin list with the email-as-last-name.

A third row has the same bug: James Lynch (`jlynchre@gmail.com`) has `last_name` = his email.

There are also matching `agent_early_access` rows for both Matt emails with `first_name = "Unknown"`, `last_name = "Agent"`, still `pending` — likely the seed of this whole mess.

## Plan

1. **Fix the data (no code change)**
   - `agent_profiles` row `b13407d8…` → set `last_name = 'Munden'`.
   - `agent_profiles` row `fd86632b…` (James Lynch) → set `last_name = 'Lynch'`.
   - Leave the typo-email duplicate `3c9d908b…` alone for now and flag it for you to decide: delete the duplicate, or keep it and delete the compass.com one. I won't merge/delete without your call.

2. **Confirm which Matt row you actually want to keep**
   - Ask you which email is real (`@compass.com` is almost certainly correct) so we can delete the other duplicate `agent_profiles` + `agent_early_access` rows in a follow-up.

3. **Sweep for the same bug across the whole table**
   - Run `SELECT id, email, last_name FROM agent_profiles WHERE last_name ILIKE '%@%'` and report the list back to you before touching anything else. Fix each by splitting the local-part or asking you, case-by-case — no bulk guessing.

4. **Out of scope for this turn**
   - No code changes to admin list, edit form, or the early-access → agent conversion flow. If you want, I can open a separate plan to harden the conversion so `last_name` never gets seeded with the email again — but that's a separate task.

### Technical notes

- Data fixes go through the insert tool (UPDATE statements), not a migration.
- The admin list (`admin-list-agents` edge function) reads `agent_profiles.last_name` directly, so once the row is corrected the admin UI will show it correctly on next load — no cache/deploy needed.
- Duplicate cleanup (step 2) will need coordinated deletes across `agent_profiles`, `agent_settings`, and `agent_early_access` for whichever id you drop; I'll plan that separately once you confirm the keeper.

**Question before I run step 1:** confirm `matt.munden@compass.com` is the correct email (so I fix that row's last name to "Munden"), and confirm "Lynch" is right for James.