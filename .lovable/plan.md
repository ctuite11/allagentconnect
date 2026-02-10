

# Fix: Approval Email — "You Have Been Accepted" with Create Password Link

**Files changed:** `supabase/functions/send-agent-approval-email/index.ts`, `src/pages/AdminApprovals.tsx`

## Problem

Two issues preventing the correct approval email:

1. For early access agents whose auth account already exists, no approval email is sent at all — the conversion function returns early and `AdminApprovals.tsx` never calls `send-agent-approval-email`.

2. The approval email template currently says "Sign In" with a link to `/auth`. It should say **"You Have Been Accepted"** with a **"Create Your Password"** button that generates a real password reset link.

## Fix

### 1. Update the Edge Function (`send-agent-approval-email/index.ts`)

- Use `supabaseAdmin.auth.admin.generateLink({ type: "recovery" })` to create a password reset link for the agent's email
- Replace the approved email HTML:
  - Subject: "You've Been Accepted — Set Up Your Account"
  - Body: "Your license has been verified" confirmation, then a "Create Your Password" CTA button linking to the generated reset URL
  - Fallback URL shown below the button
- Keep the rejection email unchanged
- Keep all existing validation, CORS, and error handling unchanged

### 2. Add the Missing Call in `AdminApprovals.tsx`

- After the early access status is updated to "verified" (line ~293), add a call to `send-agent-approval-email` with `isEarlyAccess: true`
- This ensures early access agents always receive the acceptance email, even if `convert-early-access-to-account` skipped it because the user already existed

## What This Does Not Change

- Rejection email flow — unchanged
- Real agent verification path — already calls `send-agent-approval-email`, which will now send the improved email
- `convert-early-access-to-account` function — unchanged
- Password reset page (`/password-reset`) — unchanged, already handles recovery tokens
- No database changes
