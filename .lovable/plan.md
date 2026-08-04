# Canonical agent onboarding: one activation path, two doors

Goal: access-request onboarding and direct admin invitation must both end in the exact same fully activated account state, and eligibility must never depend on a headshot.

## What the trace shows today

Both paths land on the same page (`/agent-setup`, `src/pages/AgentAccountSetup.tsx`), but that page is not a true finalizer:

- It **updates** the agent profile (`agent_profiles ... .update().eq(id)`). If no profile row exists — the normal case for a never-registered agent — the update matches nothing and setup **aborts** with "We couldn't save your profile details."
- It never creates the agent role or the settings row. It only calls `mark_agent_activated`.
- `mark_agent_activated` returns NULL (no activation) when the user has no `user_roles` row of `agent`, or when a self-calling user's `agent_status` is not `verified`/`invited`. The page logs that as a warning and still shows "You're all set" and navigates on.
- So a direct-link agent can complete name + password and end up with **no profile, no role, no `account_activated_at`** — password changed, account not activated.

Direct-link generation (`supabase/functions/generate-agent-setup-link/index.ts`) only mints a recovery link for an existing auth email. It provisions nothing, and it fails for an agent who has never existed in the system.

Communications Center eligibility (`supabase/functions/_shared/verifiedAgentAudience.ts`) currently gates on `activated OR headshot_url`, and requires an email on the profile row.

## The fix

### 1. One canonical finalization function (database)

New security-definer RPC, called by both paths and safe to re-run:

`finalize_agent_account_setup(_user_id, _first_name, _last_name, _company)` idempotently ensures, in one transaction:

- `agent_profiles` row exists (insert or update name/brokerage/email from the auth user)
- `user_roles` row `agent` exists
- `agent_settings` row exists with `agent_status = 'verified'` and `verified_at` set
- `account_activated_at` stamped once (first completion wins)

It returns the resulting activation timestamp so callers can hard-fail when activation did not happen. Callers may only finalize themselves unless they are admin/service role.

### 2. Setup page calls only the canonical function

`AgentAccountSetup.tsx`: after the password update succeeds, replace the profile `update` + warning-only `mark_agent_activated` call with a single `finalize_agent_account_setup` call. If it returns no timestamp, show an error and do **not** report success or navigate. Name and brokerage are passed into the function instead of being written separately.

### 3. Direct admin invitation provisions the account shell

`generate-agent-setup-link`: when the target email has no auth user, create one (email-confirmed, no password) before minting the link, and seed the profile/role/`agent_settings` (`invited`) rows so the link works for someone who has never touched AAC. Existing users are untouched apart from missing-row backfill.

### 4. Eligibility rule

`verifiedAgentAudience.ts`: eligibility becomes **agent role AND verified AND `account_activated_at` set**. Remove the `hasHeadshot` fallback entirely. Fall back to the auth user's email when the profile email is blank so a thin profile cannot silently drop an activated agent. Comms Center opt-in settings continue to decide whether an eligible agent actually receives a given email.

## Verification after the change

- Direct-link agent with no prior records completes setup -> auth user, agent role, verified status, profile, `account_activated_at` all present.
- Access-request agent completes setup -> identical end state.
- Re-running setup or clicking an old link twice does not duplicate rows or move `account_activated_at`.
- An activated agent with no headshot is in the Comms Center audience; a verified-but-not-activated agent with a headshot is not.

## Notes

- No email is sent, retried, or re-enqueued by this work.
- Hot Sheets and email templates are untouched.
- The old `mark_agent_activated` RPC stays in place for admin tooling; the new function wraps the same activation semantics.