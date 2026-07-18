## Goal

In Admin → Approvals, show the green **Active** badge for any verified agent whose account is usable — i.e. they have completed setup **or** already have a headshot on file. Today, agents who came in via the "Send Setup Link" path show a gray "Awaiting activation" pill even though their Verified + Headshot indicators are both green, which is misleading.

## Current behavior (confirmed in `src/pages/AdminApprovals.tsx`)

`deriveAdminStatus()`:

- `verified` + `profile_complete = true` → **Active** (green)
- `verified` + `profile_complete = false` → **Account created / Awaiting activation** (gray/amber)

`profile_complete` is the legacy composite (names + headshot + activation), so a verified agent with a headshot but no `account_activated_at` still lands in the gray bucket — the exact case you're describing.

## Change

Update `deriveAdminStatus` so a verified agent buckets as **Active** when:

```
agent_status = 'verified'
AND (account_activated_at IS NOT NULL OR headshot_url is non-empty)
```

Verified agents with neither activation nor headshot continue to show as **Awaiting activation** (gray).

No other logic changes:

- DB `agent_status` stays authoritative.
- `isAwaitingActivation()` — used to target reminder sends — is unchanged; it still keys off `account_activated_at IS NULL` so we don't stop nudging agents who truly haven't set a password.
- Email eligibility rule (verified AND (activated OR headshot)) is already correct elsewhere.
- Rejected / restricted / invited / pending buckets untouched.

## Files

- `src/pages/AdminApprovals.tsx` — adjust `deriveAdminStatus`.
- `supabase/functions/admin-list-agents/index.ts` — confirm `headshot_url` is in the returned row shape; add it to the SELECT if missing so the client can read it.

## Verification

- Reload Admin → Approvals: agents with verified + headshot but no activation now show green **Active** (matches their Verified/Headshot chips).
- Verified agents with no headshot and no activation still show gray **Awaiting activation** and remain in the reminder cohort.
- Status distribution counts still sum to the total agent count.
