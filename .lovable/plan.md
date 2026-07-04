## Goal

In Admin Approvals, distinguish agents who have logged in / activated their account from those who have also finished filling out their profile (name, headshot, brokerage, contact).

## Current state

The admin list has one "Active" bucket = `agent_status = 'verified'` AND `account_activated_at` set. There is no visibility into whether the agent has actually filled out their profile after activating.

Profile-complete is already defined in `useAgentSettings.checkProfileComplete`:
- has usable first/last name
- has headshot_url
- has company (brokerage)
- has phone or email

## Change

Split the current **Active** filter chip into two:

1. **Account Created** — verified + activated (or has auth account) but profile NOT complete
2. **Profile Complete** — verified + activated AND profile complete

Pending / Invited / Rejected / Restricted buckets stay unchanged.

### Backend (`supabase/functions/admin-list-agents/index.ts`)

Add a computed `profile_complete: boolean` to each returned agent using the same rules as `checkProfileComplete`:

```
profile_complete =
  !!(first_name && last_name) &&
  !!headshot_url &&
  !!company &&
  !!(phone || email)
```

`agent_profiles` already returns `first_name, last_name, company, phone, email`. Add `headshot_url` to the select so the flag can be computed server-side. Include `profile_complete` on both normal profiles and early-access rows (early-access = always false).

### Frontend (`src/pages/AdminApprovals.tsx`)

- Extend `Agent` type with `profile_complete?: boolean`.
- Extend `AdminDerivedStatus` union: replace `"active"` with `"account_created" | "profile_complete"`.
- Update `deriveAdminStatus`:
  - `verified` + `profile_complete` → `profile_complete`
  - `verified` (not complete) → `account_created`
- Update `statusCounts`, `variantForStatus`, filter chips, and any labels/tooltips. Chip labels: "Account Created" and "Profile Complete".
- Sort/search unchanged.

### Out of scope

- No DB schema changes.
- No changes to Success Hub onboarding overlay.
- No email or notification changes.
- `send-verification-submitted` still untouched.

## Verification

- Admin Approvals loads without errors.
- Counts across new chips sum to the previous Active count.
- An agent who logged in but has no headshot appears under **Account Created**.
- Filling headshot/company/name/contact moves them to **Profile Complete** on next reload.
