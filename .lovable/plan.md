## Goal

Get Jon Kumin (`jonkumin@gmail.com`) into his account using the same manual-onboarding pattern used for the other stuck agents: admin-set a temporary password, then email him the credentials.

## Current state

- User ID: `74c498f5-8c53-4091-8c23-ec43f74af005`
- `agent_status`: `verified`
- `account_activated_at`: NULL (never activated)
- License Verified activation email was delivered Jul 6 14:40 UTC; setup link has since expired.

## Steps

1. **Generate a temporary password** for Jon (strong random, same format used for prior manual onboardings).
2. **Invoke `admin-set-user-password`** with:
   - `email`: `jonkumin@gmail.com`
   - `password`: the generated temp password
   - This function also:
     - marks `email_confirm: true`
     - sets `agent_settings.account_activated_at` to now (if still null)
     - flips `agent_status` from `invited` → `verified` (already verified, so no-op)
3. **Send Jon the credentials email** using the same channel/template used for the other manually onboarded agents. Confirm with you which method to use before sending:
   - Option 1: Reuse whatever function/template was used last time (please confirm which — I don't want to guess and use the wrong template).
   - Option 2: If there's no reusable template, send a plain credentials email via the existing transactional queue with subject/body matching prior sends.
4. **Verify**:
   - Confirm the `admin-set-user-password` response is `{ success: true, userId: ... }`.
   - Confirm the credential email is queued in `email_jobs`.
   - Report both back to you before you regard this as done.

## No code changes

Nothing in the codebase changes. This uses existing edge functions (`admin-set-user-password` + whatever send function was used previously). No template, subject, sender, CTA, eligibility, queue, or infrastructure changes.

## Before I run this, I need one confirmation

Which send path did you use for the earlier manual onboardings — a specific edge function / template name, or did you email them directly outside the app? That determines step 3. Everything else (steps 1, 2, 4) I can execute as soon as you approve.