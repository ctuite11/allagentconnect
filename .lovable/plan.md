
## What's wrong

Audit of the agent data on `/admin/approvals` found a real inconsistency, not a UI bug:

- 178 total agent profiles
- 106 have actually signed in (auth `last_sign_in_at` is set)
- Only 41 have `agent_settings.account_activated_at` filled
- **66 agents have signed in but `account_activated_at` is NULL**

The Admin table's "Activated" column reads `!!account_activated_at`. So agents who verified, signed in, and completed a profile show "Activated: No" alongside "Profile: Yes" — which is exactly the contradiction you flagged.

Root cause: `account_activated_at` is only stamped by two code paths (`AgentAccountSetup` and `admin-set-user-password`). Anyone who set their password through a legacy path (older recovery link, admin invite before this field existed, imported accounts) never got it stamped, even though they've been signing in normally.

Sample of affected agents already signing in daily: Ben Snow, Amy Fairchild, Gabrielle Russo, Michelle Easter, Matthew Aranson, Jorge Sariego, Mark Ott, and 59 others.

Other columns (`verified_at` vs `agent_status='verified'`, etc.) reconcile cleanly — no mismatches there.

## Plan

One-time backfill migration to set `account_activated_at` for agents who have clearly already activated. No UI or component changes.

**Rule for backfill**: for every `agent_settings` row where `account_activated_at IS NULL` AND the auth user has `email_confirmed_at IS NOT NULL` AND `last_sign_in_at IS NOT NULL`, set:

```
account_activated_at = COALESCE(
   auth.users.confirmed_at,
   auth.users.email_confirmed_at,
   auth.users.last_sign_in_at
)
```

This uses the earliest confirmed activation signal from auth, so historical timestamps stay accurate rather than collapsing everything to "now".

Scope guard: only touch rows where the field is currently NULL — never overwrite an existing activation timestamp.

After the migration, the admin table on `/admin/approvals` will show "Activated: Yes" for all 66 affected agents on the next fetch, and no "Activated=No / Profile=Yes" rows will remain for agents who have actually signed in.

## Technical details

Single migration, updates only `public.agent_settings`. Reads from `auth.users` via a join (allowed inside a Postgres migration; no schema changes to `auth`). No RLS or grant changes.

Not addressed (call out only, not fixing in this pass):
- Preventing future drift. The current activation code paths are correct; new agents going through `AgentAccountSetup` or `admin-set-user-password` do get stamped. A defensive on-sign-in backfill (client- or trigger-based) could be added later if you want belt-and-suspenders, but it's not needed to correct the current data.
