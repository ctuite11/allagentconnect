## Audit result

Alice Miles's status (verified, `account_activated_at IS NULL`, no headshot, no bio, no `last_seen_at`) matches **69 other agents** currently in the system. Every one of them has an empty profile shell — no headshot, no bio, no recorded sign-in.

### Age buckets (days since verification)

```text
Days since verified   Count   Notable AAC range
────────────────────────────────────────────────
23 days (2026-06-29)   28     AAC-0100 → AAC-0166
17–19 days             10     AAC-0197 → AAC-0213
10–15 days             13     AAC-0222 → AAC-0257
 8–9  days              6     AAC-0265 → AAC-0280
 4–5  days              3     AAC-0286, 0290, plus Ryan Shannon
 0–2  days              9     AAC-0293 → AAC-0305
```

Oldest cohort (23 days, 28 agents) has had over 3 weeks to activate and hasn't. Newest cohort (0–2 days) has barely had a chance.

## What I need from you

Pick a deletion threshold and I'll run the same hardened deletion path used for Alice (removal email → `delete-users` edge fn → verify `agent_profiles` / `agent_settings` / `pending_verifications` cleared → auth queued):

1. **Delete only the 23-day cohort** (28 agents, verified 2026-06-29) — most conservative
2. **Delete everyone ≥14 days since verified** (~41 agents)
3. **Delete everyone ≥7 days since verified** (~60 agents)
4. **Custom threshold** — tell me the day count
5. **Send one more resend-setup email** to the oldest cohort first, then delete non-responders in ~3 days

For any option I'll show you the final list before executing, and skip anyone you want spared.

### Technical notes
- Same query as Alice's audit: `agent_profiles` LEFT JOIN `agent_settings` WHERE `account_activated_at IS NULL`.
- Deletion path is idempotent and already handles the "verified but never activated → no `deleted_users` archive row" case, matching Alice.
- No code changes needed — this is a data operation only.
