
## Agent Network / Admin Activated reconciliation (2026-09-02)
- [x] Harden get_verified_agent_ids() to accept last_sign_in_at as activation evidence
- [x] Backfill declined: account_activated_at is shown as a date in AgentDetailsDrawer; left null
- [x] Reported: 267 -> 281; 3 intentional exclusions

## Send setup links to verified agents with expired links (pending approval)
- 47 verified, never-signed-in agents (Irina excluded — already has password) have NO live link: no pending activation token, no issued login token, no unused resend handle, no setup/login email in last 7 days
- Recent "license verified" emails (Jenna Taylor 9/2, Carolyn Pimental + Gail LiDonni 9/1) contain no link — those agents still expired
- Awaiting user confirmation before bulk send via resend-activation-link / send-login-link flow

## Copy setup link -> 30-day AAC token (2026-09-13, DONE except live smoke test)
- [x] Added issue_agent_activation_token_no_email / issue_agent_login_token_no_email
      (service_role only, 31-day guard, no email_jobs insert). Existing emailing RPCs untouched.
- [x] generate-agent-setup-link no longer uses Supabase recovery links; deployed
- [x] Activation-state rule = agent_settings.account_activated_at (never last_sign_in_at)
- [x] Drawer copy -> "AAC activation/setup link (30 days, single-use)"
- [ ] BLOCKED: live authenticated click-through smoke test — admin test session was declined
- Frontend NOT published yet (awaiting review)

## Concierge review email handoff (backend deployed, frontend built, NOT published)
- [x] Eligibility: verified members (activated or not) for concierge create/manage/send
- [x] send-concierge-review-email edge function + listing-preview template
- [x] returnTo carried through /signin-link (login token) and /activate (activation token)
- [x] Agent review/publish screen at /agent/listings/review/:id
- [x] Admin "Send to Agent for Review" action
- [ ] BLOCKED: controlled live email test — awaiting user's designated test address/account
- [ ] Publish concierge frontend after email test passes (stop before Publish in test; no buyer alerts)

## Tooltip cleanup (pending publish)
- [x] AgentEmailHistory.tsx: "setup/recovery link" -> "setup link"

## Read-only verification: Copy setup link (30-day, silent)
- [x] Confirm token paths, no-email variants, 30-day TTL, hash-only persistence, token replacement, email flows unchanged, wording, type-check + build — no tokens issued
