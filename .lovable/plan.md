# Harden Agent Approval Gate

## Context

Sikander Khan got a verified agent account because:
1. Self-signup created `auth.users` + `agent_settings` with `verified_at = NULL` (gate held).
2. An admin (`chris@allagentconnect.com`) clicked **Verify** in `/admin-approvals` ~1h46m later, which set `verified_at = now()` and sent the approval email.

The system *did* require admin approval — but nothing flagged that license `123456` and area code `030` were obviously bogus, and there's no audit trail.

This plan does **four things**: (1) immediate cleanup of this account, (2) make fake submissions hard at signup, (3) make fake submissions impossible to miss in the admin queue, (4) verification audit log.

## Out of scope

- RLS rewrites — `verified_at IS NULL` gating already blocks unverified agents from agent-only actions.
- Real license-board API integration (separate effort).
- Buyer signup flow.

## 1. Immediate cleanup — revoke Sikander's account

Data update via insert tool:
- `agent_settings`: `verified_at = NULL`, `approval_email_sent = false` for `user_id f7942f66…`.
- `agent_profiles`: clear `aac_id` so the slot is reusable.
- Default: keep the auth user (he can re-apply with real info). **Open question 1** below.

## 2. Signup-side validators

New `src/lib/agentSignupValidation.ts` + Zod schema in `src/pages/Auth.tsx`. Hard-fail with toast — these are not warnings.

| Field | Rule |
|---|---|
| Phone | 10 digits; area-code first digit 2–9; exchange first digit 2–9. Rejects `(030) 241-3631`. |
| License number | Reject all-same-digit, strictly sequential (`123456`/`654321`), or <4 chars. |
| License last name | Must equal form `last_name` (case-insensitive). |
| Email | Reject disposable-domain list (mailinator, tempmail, guerrillamail, 10minutemail, yopmail, …). |
| First/last name | Min 2 chars; letters, spaces, hyphens, apostrophes only. |

Same checks duplicated server-side in a new `validate-agent-signup` edge function called immediately before `signUp()` so direct-API bypass isn't possible.

## 3. AdminApprovals red-flag surfacing (`src/pages/AdminApprovals.tsx`)

`RiskBadges` component on every pending card runs the same validators and renders red pills next to flagged fields:

- "Invalid phone" (red)
- "Placeholder license" (red)
- "Last name mismatch" (red)
- "Disposable email" (red)
- "No company" (amber — soft signal)

If **any red badge** is present, the **Verify** button becomes a confirm dialog: *"This submission has flagged data: [list]. Type VERIFY to confirm approval."* That's the speed bump that would have stopped this one.

## 4. Verification audit log

New table:
```
public.agent_verification_audit (
  id uuid pk,
  agent_user_id uuid,
  admin_user_id uuid,
  action text check (action in ('verified','rejected','restricted','reverted')),
  notes text,
  created_at timestamptz default now()
)
```

- RLS: admins read-only.
- Insert via security-definer trigger on `agent_settings.verified_at` change so it can't be skipped.
- New tab on `/admin-approvals` showing recent decisions with admin name + timestamp.

## 5. Acceptance checks

- Signup with phone `(030) 241-3631` is rejected client- and server-side.
- Signup with license `123456` is rejected.
- An existing pending submission with any red flag shows badges and requires typing VERIFY.
- After Verify, `agent_verification_audit` has a row with the admin's user id.
- Sikander's account no longer has `verified_at`; he lands on `/pending-verification` if he logs in.

## Open questions

1. **Sikander's account**: revoke `verified_at` only (he can re-apply if real), or hard-delete the auth user? Default: revoke only.
2. **Disposable-email list**: small built-in list now, or wire to a maintained external list later? Default: built-in.
3. **Last-name match**: exact case-insensitive, or fuzzy? Default: exact case-insensitive.

Reply with answers (or "go with defaults") and I'll implement.
