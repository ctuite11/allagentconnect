

# Fix: Remove Duplicate "Waiting for Verification" Email

## The Problem

When a new agent registers, they receive **two** emails saying they're waiting for verification:

1. **Auth Hook email** ("Confirm your email for AllAgentConnect") -- sent automatically by the `send-auth-email` edge function, triggered by Supabase on every signup
2. **Pending approval email** ("Welcome -- You're Almost In") -- sent by the `send-pending-approval-email` Netlify function, called from the `PendingVerification.tsx` page

Both fire within seconds of registration. They're redundant.

## Fix

**File:** `src/pages/PendingVerification.tsx`

Remove the `sendPendingApprovalEmail` function and its invocation entirely (lines 23-43 and the call around line 157). The `emailSentRef` ref can also be removed.

The Auth Hook email already tells the user their account is being reviewed. The PendingVerification page itself shows the live status. And when approved, the `send-agent-approval-email` function sends the "You've Been Accepted" email with a password setup link.

**What stays:**
- The Auth Hook signup confirmation email (already works)
- The PendingVerification page UI (polling, status display)
- The approval email on verification (`send-agent-approval-email`)

**What gets removed:**
- `emailSentRef` ref declaration (line 22)
- `sendPendingApprovalEmail` function (lines 24-43)
- The block that calls `sendPendingApprovalEmail` (lines ~155-170, inside the `pending/unverified` status check)

No other files change. No edge function changes. No database changes.

