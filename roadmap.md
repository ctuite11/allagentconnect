
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

- [ ] Urgent: resolve post-login spinning “no access” state after Cloud outage

- [ ] Re-enable concierge frontend: set CONCIERGE_LISTINGS_ENABLED = true in src/config/featureFlags.ts after the review-email test is approved.

## Password reset visibility + misclick guard (2026-09-15, backend deployed, frontend NOT published)
- [x] Audited both paths: member Forgot Password (agent/buyer/consumer/DCMLS) and admin both already send immediately, no approval step
- [x] Admin action renamed "Email password reset" with confirm; "Set password (no email)" separated by dividers (menu + details drawer)
- [x] send-password-reset writes an audit-only email_jobs row after provider acceptance (status 'sent', provider_message_id, key password-reset:<message-id>, no delivery_status set)
- [x] Migration 0004: email_stream_for_template 'password-reset' -> transactional; admin_agent_email_summary latest-templates includes 'password-reset'
- [x] Label "Password Reset" in emailTemplateLabels
- [x] Link lifetime unchanged (1 hour); no activation/setup/temp-password changes
- [x] Live test to christuitet11@gmail.com: exactly one email, exactly one audit row, webhook updated delivery to delivered

## Activation status identity join (done)
- admin_auth_user_signin_map_v2 returns auth user id + email + last_sign_in_at (service_role only).
- admin-list-agents resolves has_auth_account / last_sign_in_at by auth user id first, email fallback.
- Fixes Allison Avramovich (profile email != sign-in email) showing Verified instead of Activated.
- Deployed; no frontend publish needed (response contract unchanged).

## Darcy Bento forwardable AAC invitation (2026-09-18)
- [x] Source Darcy's official headshot and Bento Real Estate logo.
- [x] Add both images and Darcy's contact details to the agent-forward invitation.
- [x] Deploy the invitation sender and send one copy to chris@allagentconnect.com.
- [x] Confirm exactly one email job reaches sent and delivered status.

## Short Darcy Bento forwardable invitation (2026-09-19)
- [x] Replace the brochure-length agent-forward copy with the approved concise membership invitation.
- [x] Preserve Darcy's headshot, Bento Real Estate logo, contact details, reply-to, and forwardable registration link.
- [x] Deploy only the agent-forward invitation sender.
- [x] Send exactly one replacement copy to chris@allagentconnect.com and confirm delivery.

## Agent invitation visual refresh (2026-09-19)
- [x] Split the hero headline between white and AAC green.
- [x] Crop and host the supplied listing-search screenshot for email delivery.
- [x] Add the single product-preview section with the approved copy and caption.
- [x] Deploy and verify only the agent-forward invitation sender; no email sent or queued.
