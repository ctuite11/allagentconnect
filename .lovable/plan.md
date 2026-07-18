## Problem

In the last change I made "Active (green)" and "Profile Complete" the same bucket in `deriveAdminStatus`. That inflated the **Profile Complete** count in Admin → Approvals — it now includes verified agents who are activated but don't actually have a complete profile (missing headshot, names, brokerage, etc.). Confirmed against the database: 179 verified agents are activated, but many of them do not have a real completed profile, so labeling all of them "Profile Complete" is wrong.

The green Active pill and the Profile Complete tab are two different concepts and should not share a bucket.

## Fix

Split the two concepts back apart in `src/pages/AdminApprovals.tsx`.

### 1. Restore `deriveAdminStatus` to profile-truth

`profile_complete` bucket returns to its original meaning: `agent_status = 'verified' AND profile_complete = true` (the real name + headshot + brokerage + contact composite from the backend).

```
verified + profile_complete=true          → "profile_complete"
verified + profile_complete=false         → "account_created"
```

The Profile Complete tab count goes back to reflecting agents with an actually complete profile, not "usable account".

### 2. Keep the green Active pill for usable accounts

Introduce a separate `isAccountActive(a)` helper used only for the row's status pill:

```
isAccountActive = agent_status='verified'
                  AND (account_activated_at IS NOT NULL OR headshot_url non-empty)
```

The row-level pill shows green **Active** when `isAccountActive` is true, even if `profile_complete` is false — this preserves the fix from last turn (agents who came in via Send Setup Link with a headshot don't look "Awaiting activation").

Verified agents who are neither activated nor have a headshot continue to show gray **Awaiting activation**.

### 3. Left rail bucket counts

- **Profile Complete (N)** — strict: verified + `profile_complete=true`. Back to previous number.
- **Account created / Awaiting activation** — verified + `profile_complete=false` (includes both "green pill but profile not filled in" and "gray pill, no activation and no headshot").
- Pending / Rejected / Restricted / Invited untouched.

### 4. No changes to

- `admin-list-agents` edge function (`profile_complete` and `headshot_url` are already returned).
- Email eligibility (`verifiedAgentAudience.ts`) — that helper already uses the correct `activated OR headshot` rule and is not affected.
- `isAwaitingActivation()` — still keys off `account_activated_at IS NULL` for reminder targeting.

## Files

- `src/pages/AdminApprovals.tsx` — revert the OR-branch inside `deriveAdminStatus`; add `isAccountActive`; render the row pill from `isAccountActive` instead of the bucket.

## Verification

- Profile Complete count drops back to the real profile-completed count (was ~previous value, not 176/179).
- A verified agent with a headshot but no activation still shows green **Active** in the row.
- A verified agent with no headshot and no activation still shows gray **Awaiting activation**.
- Left-rail bucket totals still sum to the total agent count.
