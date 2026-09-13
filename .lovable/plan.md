# Make admin setup links consistently 30 days

## Goal
Remove the stale "~1 hour" Supabase recovery link from the admin **Copy setup link** action and from the **Activation Reminder Details** drawer copy. Admin-generated setup links will use the same 30-day AAC token system as the License Verified / Email setup link flow.

## What will change

1. **Edge Function `generate-agent-setup-link`** will stop calling `supabase.auth.admin.generateLink({ type: "recovery" })` and instead issue an AAC-owned token:
   - Not-yet-activated agents → 30-day activation token (`/activate#t=<token>`).
   - Already-activated agents → 30-day login token (`/signin-link#t=<token>`).
   - The returned `setupUrl` will be a 30-day link in both cases.
2. **AgentDetailsDrawer** "Activation Reminder Details" section will show "AAC activation/setup link (30 days, single-use)" instead of the current "Fresh Supabase recovery / setup link (single-use, ~1 hr)" hard-coded line.
3. The edge function will be redeployed.

## Out of scope
- `send-license-verified-email` and **Email setup link** already use the 30-day activation token; no change.
- **Set Password** sets a permanent password directly; no link involved; no change.
- No database schema, RPC, RLS, or email-queue changes.
- No emails will be sent or queued.
- No publish to production until separately approved.

## Technical details

### `supabase/functions/generate-agent-setup-link/index.ts`
- Keep existing admin-gate and email/userId resolution.
- After resolving the `user_id`, check activation state via `auth.users.last_sign_in_at` / `account_activated_at` to decide token type.
- For not-yet-activated agents: call existing `issue_agent_activation_token` RPC (used by `send-license-verified-email`), then build the URL with `activationUrl(AAC_PUBLIC_URL, token)` from `_shared/activationTokens.ts`.
- For already-activated agents: call existing `issue_agent_login_token` RPC (used by `send-login-link`), then build the URL with `loginLinkUrl(AAC_PUBLIC_URL, token)` from `_shared/loginTokens.ts`.
- Return `{ setupUrl, email, tokenType, expiresAt }` to the caller. The plaintext token is never persisted; only its hash is stored by the RPC.
- Preserve existing error shapes and CORS headers.

### `src/components/admin/AgentDetailsDrawer.tsx`
- Change line ~331 hard-coded link type text:
  ```
  AAC activation/setup link (30 days, single-use)
  ```
- No other drawer behavior changes.

### `src/pages/AdminApprovals.tsx`
- The `handleCopySetupLink` caller only copies the returned `setupUrl`; no logic change required unless the returned shape changes. The toast text "Setup link copied to clipboard" remains accurate.

## Verification
- Type-check and build the project.
- Deploy only the `generate-agent-setup-link` edge function.
- Smoke-test in preview: open an unactivated agent, press **Copy setup link**, verify the copied URL starts with `/activate#t=` and contains a 30-day token payload.
- Smoke-test with an activated agent: verify the copied URL starts with `/signin-link#t=`.
- Confirm the drawer no longer mentions "~1 hr" or "Supabase recovery".
