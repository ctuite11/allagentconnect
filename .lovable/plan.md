# Admin search shows zero matches for an existing verified agent

## Root cause (confirmed by reads)

- tuite.chris11@gmail.com **has a real, verified agent account** (created June 4, 2026; roles: agent + buyer; `agent_settings.agent_status = verified`; not hidden, not deleted). The invite screen's "email is in use" is **correct** — existing accounts can't be re-invited.
- The admin page roster is built by the `admin-list-agents` edge function **from `agent_profiles`**. This account has **no `agent_profiles` row**, so it never loads into the admin list — searching its email returns zero matches even though admin search does match on email.
- The gap is small and historic: exactly **7 verified agents** lack an `agent_profiles` row. All are early May–June 2026 accounts (your own test/family accounts: chris.tuite@compass.com, tuite.chris11@gmail.com, nataliia.tuite@gmail.com, boo@allagentconnect.com, nataliia@directconnectmls.com, n.lopachak@gmail.com, mbaltimore@gmail.com). They predate whatever now creates `agent_profiles` rows during onboarding/verification.

## Plan

1. **Backfill the 7 missing `agent_profiles` rows** (one migration): insert minimal rows (id, first_name, last_name from `profiles`) for verified agents that lack one. No other columns touched; no emails or side effects.
2. **Harden `admin-list-agents`** so this can't silently recur: agents with an `agent_settings` row but no `agent_profiles` row still appear in the roster (fall back to `profiles` for name/email). This is a read-path change only.
3. **Verify:** the 7 accounts appear in the admin roster and are findable by email search; roster count changes by exactly +7; no other accounts affected; type-check/build pass.

## Safety

- No emails, invitations, or notifications. No changes to roles, statuses, visibility, or any other account data.
- The invite flow stays unchanged: existing accounts correctly block new invites.

## Optional (only if you want it)

- A friendlier invite message ("This person already has an account — Chris Tuite") instead of just "in use". Not included unless you ask.
