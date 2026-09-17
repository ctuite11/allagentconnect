# Option A — fix the missing "Activated" stamp (Brigid Murphy + 22 others)

## 1. Root cause — confirmed, read-only

Activation is recorded by one database routine, `mark_agent_activated`. Today only three places call it:

- the account-setup screen, when a member finishes setting a password
- the normal email + password sign-in form
- the password-reset screen

Signing in through a **sign-in link** goes through none of them. The link-redemption path claims the token, marks it redeemed, hands back a one-time sign-in and drops the member on the dashboard — it never records activation. So a member can be fully authenticated with `account_activated_at` still empty. That is exactly what happened to Brigid on Aug 18.

## 2. Audit — 23 affected members

Approved members who have an account, have genuinely signed in, but show no activation date:

| Group | Count | Evidence of sign-in |
| --- | --- | --- |
| Signed in via a redeemed sign-in link | 18 | redeemed login token + recorded sign-in |
| Redeemed a setup link, signed in, never finished the setup screen | 5 | redeemed activation token + recorded sign-in |

Group 1 includes Brigid Murphy, Jason Niles, Carolyn Pimental, Jenna Taylor, Tracy Shea, Jessica Witter-Aladesanmi, Gayle Winters, Robyn Nasuti, Franklin Knotts, Steve Facelle, Ryan Drowne, Donald Cranley, Deanna Salemme, Margaret Belmonte, Joanne Adduci, Tony Nenopoulos, Anne Mahon, Lauren O'Brien. Every one of these is showing in Admin as "Verified" when they are actually active members.

Note: all 23 have a stored password, but that alone is not proof they chose one — accounts are created with a password. Only the recorded sign-in is treated as proof here.

## 3. Permanent fix (narrow)

Record activation at the moment a sign-in link is successfully redeemed. In the redemption function, after the token is confirmed redeemed and the one-time sign-in has been issued, call the existing `mark_agent_activated` routine for that member with server-level rights.

- It is already idempotent: it only writes when no activation date exists.
- It is already restricted to members with the agent role.
- Nothing changes for anyone who has never authenticated — no token, no sign-in, no stamp.
- Failure to stamp never blocks the sign-in (best-effort, logged only).

No change to the definition of activation anywhere else, no change to the setup screen, the password sign-in path, lifecycle rules, pills, filters or counts.

## 4. Backfill (proof-based only)

One data update, restricted to exactly the 23 rows above: approved members who have both a real recorded sign-in and a redeemed link. Activation date is set to their **first proven authentication** (their redeemed token time), not today, so history reads correctly. No blanket update of approved members.

## 5. Brigid

Once her activation date is corrected, she is an activated member, so Admin issues her a **30-day sign-in link** — not a setup link. She keeps her existing password and lands straight in her dashboard. Nothing else about her record changes.

## Technical notes

- Confirmed callers of `mark_agent_activated`: `AgentAccountSetup.tsx:315`, `Auth.tsx:547`, `PasswordReset.tsx:131`. Absent from `redeem-login-token/index.ts` and from `complete_agent_login_token`.
- Fix location: `supabase/functions/redeem-login-token/index.ts`, after `complete_agent_login_token` returns true, `await admin.rpc('mark_agent_activated', { _user_id: userId })` inside try/catch. Service-role client already present; `mark_agent_activated` already permits service_role.
- Optional follow-up (not in this change): the 5 members who abandoned the setup screen would be covered by the same rule if `redeem-activation-token` stamped on completion — flagged, not proposed here.
- Backfill statement scope: `agent_settings` rows where `account_activated_at IS NULL`, `agent_status = 'verified'`, `auth.users.last_sign_in_at IS NOT NULL`, and a redeemed login or activation token exists; set to the earliest redeemed-token time.
- Deploy: `redeem-login-token` only. No schema, RLS, grant, template or migration changes. Frontend untouched, no publish needed.

## Verification before/after

- Count of affected rows before (23) and after (0).
- Roster lifecycle counts: Verified −23, Activated +23, total unchanged.
- Brigid's row reads Activated with Aug 18.
- `email_jobs` count identical — no email sent or queued by any step.
- Type-check and production build pass.

## Guardrails

Nothing is sent, issued, changed or deployed until you approve this plan.
