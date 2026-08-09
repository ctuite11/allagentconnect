# Comms emails from Aug 8 — sent, but not to you

## What actually went out yesterday

- **Buyer Need broadcast** — "[Buyer Need] ISO off market Multi" (Medford/Malden/Melrose/Salem, multi-family, up to $1.2M), created 12:59 AM. Audience 85: **79 immediate emails** plus **4 daily digests**, all recorded delivered.
- **Daily digest** — 4 sends (1 at 1:00 AM, 3 at 10:00 PM), all delivered.
- Totals for the day on the communications stream: 279 delivered, 6 sent-not-yet-confirmed, 6 bounced. No failures, nothing stuck in the queue.

So the system did send. You were simply not in the audience.

## Why you did not receive it

Your agent account is verified and activated, but your Communications Center preferences have **never been saved** (`notifications_set = false`, no towns, no property types, no price range).

Under the current policy — never-configured Comms Center means all Comms Center email is off — the audience builder excludes you by design. That is why 85 other agents got the Buyer Need and you did not. Your Hot Sheet and system emails were unaffected: you received three Hot Sheet match alerts and three status-change alerts on Aug 8, plus the license-verification admin alerts.

## Options

1. **Save your preferences in the app** (recommended). Open Communications Center preferences, pick your states/towns, property types and price range, and save. That flips the opt-in flag through the normal path and you start receiving matching broadcasts immediately. No code or data change.
2. **Opt you in for everything.** Save your preferences with no geographic/type filters so you receive all applicable network broadcasts — useful for admin oversight of what agents are getting.
3. **Do nothing.** Leave your account out of network broadcast email.

No back-fill or resend of yesterday's broadcast is included in any option, per the standing no-replay rule.

## Technical notes

- Gate lives in the shared audience builder (`verifiedAgentAudience.ts`): the opt-in flag is mandatory since the "everything on" experiment was reverted.
- Verification only, no writes were made during this check.
