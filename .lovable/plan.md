

# Fix: Recovery Link Redirects to Wrong Page

## Problem

The "You've Been Accepted" email contains a recovery link that redirects directly to `/password-reset`. But `/password-reset` requires a sessionStorage marker (`aac_recovery_flow`) that is only set by `/auth/callback`. Since `/auth/callback` is never visited, the marker is missing and PasswordReset shows "Link Expired."

## Fix

**File:** `supabase/functions/send-agent-approval-email/index.ts` (line 86)

Change the `redirectTo` from:
```
https://allagentconnect.com/password-reset
```
to:
```
https://allagentconnect.com/auth/callback
```

This routes the recovery token through `AuthCallback.tsx`, which:
1. Detects `type=recovery` in the URL
2. Sets `aac_recovery_flow` marker in sessionStorage
3. Establishes the auth session via `setSession()`
4. Redirects to `/password-reset`

This is the same proven path used by the manual password reset flow.

## What Changes

- One line in `send-agent-approval-email/index.ts` (the `redirectTo` value)
- Redeploy the edge function

## What Does Not Change

- PasswordReset page logic
- AuthCallback logic
- Email template content
- No database changes

