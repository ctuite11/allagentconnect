## Goal

Distinguish "verified + email sent" from "agent actually created their password and activated their account" in the Admin Verified tab.

## Data source

Add a durable column `agent_settings.account_activated_at timestamptz` (nullable). This is the canonical activation marker. Reasoning:

- `auth.users.last_sign_in_at` is already returned by `admin-list-agents` but a sign-in does not mean setup was completed (and isn't set for some flows).
- An explicit timestamp written exactly when `/agent-setup` finishes is unambiguous and won't be retroactively set for the 18+ historical verified agents who never finished setup.

### Backfill rule (conservative)
Do NOT mark historical agents active. Leave `account_activated_at = NULL` for everyone, with one safe exception: agents whose `auth.users.last_sign_in_at IS NOT NULL` AND `agent_status = 'verified'` AND email confirmed — they have demonstrably used their account. We'll backfill those with their `last_sign_in_at` value so the admin view isn't full of false "Setup pending" rows for people who are actually using the app. Everyone else (incl. the 16 we just moved back to pending, plus Emily/Michelle/Covelle/Bateson if they haven't signed in) stays NULL = Setup pending until they complete `/agent-setup` or sign in again.

## Implementation

1. **Migration** — add `account_activated_at timestamptz` to `agent_settings`. Backfill per rule above using `auth.users.last_sign_in_at` joined by email.

2. **`/agent-setup` completion** (`src/pages/AgentAccountSetup.tsx`) — right after `supabase.auth.updateUser({ password })` succeeds, upsert `agent_settings.account_activated_at = now()` for the current user (only if currently NULL, to preserve the first-activation timestamp).

3. **`admin-list-agents` edge function** — include `account_activated_at` in the row payload for real agents (NULL for early-access leads).

4. **`AdminApprovals.tsx`** — extend the `Agent` type and table:
   - Add **Account Status** column on the Verified tab only (between current status and verified date).
   - Render: green dot `Account active` + relative timestamp if `account_activated_at` is set; amber dot `Setup pending` otherwise.
   - Add a row-level "Resend setup link" action when Setup pending (reuses existing `send-license-verified-email` with the per-agent idempotency key from earlier work — no duplicate-send risk).

5. **No changes** to Verified tab membership rules, Pending/Unverified tabs, the License Verified email template, or the `/agent-setup` UI beyond the activation write.

## Verification

- New verified agent → email sent → tab shows **Setup pending**.
- Agent opens setup link, sets password → row flips to **Account active** with timestamp.
- Historical verified agents who already signed in (e.g. Chris) show **Account active** via backfill; those who never finished show **Setup pending**.
- No agent is falsely marked active without an auth signal.
