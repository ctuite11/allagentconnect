
## Agent Network / Admin Activated reconciliation (2026-09-02)
- [x] Harden get_verified_agent_ids() to accept last_sign_in_at as activation evidence
- [x] Backfill declined: account_activated_at is shown as a date in AgentDetailsDrawer; left null
- [x] Reported: 267 -> 281; 3 intentional exclusions

## Send setup links to verified agents with expired links (pending approval)
- 47 verified, never-signed-in agents (Irina excluded — already has password) have NO live link: no pending activation token, no issued login token, no unused resend handle, no setup/login email in last 7 days
- Recent "license verified" emails (Jenna Taylor 9/2, Carolyn Pimental + Gail LiDonni 9/1) contain no link — those agents still expired
- Awaiting user confirmation before bulk send via resend-activation-link / send-login-link flow

## Copy setup link -> 30-day AAC token (2026-09-13, BLOCKED pending decision)
- Approved: replace Supabase ~1hr recovery link in generate-agent-setup-link with 30-day activation/login token
- Approved: drawer copy -> "AAC activation/setup link (30 days, single-use)"
- BLOCKER reported to user: issue_agent_activation_token AND issue_agent_login_token both
  unconditionally INSERT an email_jobs row, so "Copy setup link" would queue+send a real email.
  No no-email issuance variant exists. Requires an RPC change (out of scope without approval).
- Expiry guard is already 31 days on both paths, so 30-day TTL itself is fine.
