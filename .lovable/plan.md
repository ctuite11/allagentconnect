# Fix the Admin Approvals page hanging, then showing "No agents found"

## What is actually happening

Confirmed from the live logs for the last few loads of the admin page:

```text
02:47:52  admin member list   200    0.1s
02:48:12  admin member list   401   19.7s
02:48:38  admin member list   401   19.7s
02:49:14  admin member list   200    0.1s
```

The two failed loads each hung for roughly **20 seconds** and then came back rejected. The
matching service log says `Auth error: HTTP 522` — the very first thing the admin list does is
ask the sign-in service "who is calling?", and that single call stalled and timed out. The
member list itself was never read.

Two separate problems follow from that:

1. **The stall is unprotected.** That identity check has no timeout and no retry, so one slow
   moment leaves the admin staring at a spinner for 20 seconds.
2. **The failure is reported as emptiness.** When the call comes back rejected, the page keeps
   an empty member list and falls through to the generic **"No agents found"** card. It looks
   like the roster is gone, when in reality the list was never loaded.

The backend is healthy right now, so this is an intermittent slow-response problem, not an
outage — but the page handles it badly every time it happens.

## Fix

**1. Make the identity check fast and self-healing (admin member list service)**
Put a short timeout around the "who is calling?" check and retry it briefly (a couple of quick
attempts) before giving up. A transient stall then costs a second or two instead of twenty, and
usually succeeds on the retry. The permission rules are untouched: the caller must still be a
signed-in admin, and a genuinely invalid session is still rejected exactly as today.

**2. Tell the truth on the page (Admin Approvals)**
When the load fails, set an explicit error state instead of leaving an empty list. Show a clear
"We couldn't load the member list" card with a Retry button, rather than the misleading
"No agents found" message. "No agents found" stays reserved for a load that genuinely returned
zero members.

**3. Retry once automatically**
If the first load fails on a transient error, retry it once in the background before showing
the error card, so a single blip resolves itself without the admin doing anything.

## Scope guard

No changes to who can access the admin page, no changes to member records, no emails, no queue
writes, no database migration, no redesign of the page. Only the identity-check resilience in
the admin list service and the loading/error handling on the Admin Approvals page.
