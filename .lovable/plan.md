## Root cause

`src/pages/AdminApprovals.tsx:471-479` defines the **Verified** tab as "has an auth account", not "agent_status = verified":

```ts
if (a.has_auth_account) verified++;
```

Filter at line 505-506 matches:
```ts
} else if (statusFilter === "verified") {
  result = result.filter((a) => a.has_auth_account === true);
```

Michelle and Emily signed up through `/auth?mode=register`, so they have auth accounts → they land in the **Verified** tab even though `agent_status = 'pending'` in the DB. They are *not* actually verified, and they have not received the License Verified email. That's why the Verified count looks inflated (~55) and why you cannot find them under Pending to send the email.

The send action itself is fine — the bug is the bucket they're shown in.

## Fix

Repoint the Verified/Pending tabs to use `agent_status` truthfully, keeping `has_auth_account` only as a secondary signal.

1. **Edit `src/pages/AdminApprovals.tsx`** — Status counts and filter logic:

   ```text
   Verified  = agent_status === 'verified'
   Pending   = has_auth_account === true AND agent_status === 'pending'
   Unverified = has_auth_account !== true        (unchanged: early-access leads w/o accounts)
   ```

   - Update the `statusCounts` memo (lines ~470-479).
   - Update the `filteredAgents` memo branches for `"verified"` and `"pending"` (lines ~502-510).
   - Leave Rejected/Restricted/Unverified untouched.

2. **No DB changes.** Michelle and Emily stay `pending` exactly as they are.

3. **You then send the email normally.** After the fix, both appear under the **Pending** tab; click **Send License Verified** on each. Existing 10-min idempotency + in-flight guard apply.

## Out of scope (separate follow-ups, already planned)

- Repointing HomepageV2 "Request Access" CTAs from `/auth?mode=register` to `/register` so future signups go through Early Access intake.
- Backfilling Michelle/Emily's missing name/brokerage/state/license — they bypassed the intake form so their profile fields are blank.

## Technical notes

- `has_auth_account` is still useful for the Unverified bucket (early-access leads with no auth row yet).
- No edge-function, RPC, or migration changes — purely client-side filter correction.
- Verify after edit by opening AdminApprovals → Verified count drops by ~the number of pending-but-auth'd agents; Michelle and Emily appear in Pending; clicking **Send License Verified** enqueues an `email_jobs` row.
