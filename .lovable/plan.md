## Goal
Confirm the agent-approval email is sending from `hello@allagentconnect.com` (apex domain) and lands in the Inbox, not Spam.

## Steps

1. **Trigger one live send** of the `send-agent-approval-email` Edge Function with:
   - recipient: `doittuite3@yahoo.com`
   - branch: `approved` (uses the restored branded template + "You've Been Accepted — Sign In to Your Account" subject)
   - magic-link CTA generated against `PUBLIC_SITE_URL`

2. **Pull the function logs** for that invocation and confirm:
   - `from` resolves to `All Agent Connect <hello@allagentconnect.com>` (from `TRANSACTIONAL_FROM` secret)
   - `reply_to` is `hello@allagentconnect.com`
   - Resend returned a `message_id` with no error

3. **You check the Yahoo inbox** and report back:
   - Inbox vs Spam placement
   - From line displayed
   - Branded layout renders (green checkmark, Sign In CTA)

4. **If it lands in Spam**: inspect the raw message headers (DKIM `d=`, SPF, DMARC alignment, `Return-Path`) and decide next action — likely a DNS check on `allagentconnect.com` SPF/DKIM since the apex is now the visible From.

## Notes
- No code changes in this plan — verification only.
- I cannot read your inbox; step 3 requires you to look and tell me what you see.
