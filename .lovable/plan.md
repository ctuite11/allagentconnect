# Database capacity incident — root-cause investigation

## What the read-only investigation found (Sep 25, 20:51–21:05 UTC)

**The database restarted tonight at 20:50:42 UTC** — 9 minutes before you noticed the outage. Postgres logged FATAL "the database system is not accepting connections" (shutdown), was back up by 20:51:21, and the platform status has been healthy since (auth reachable, auth→database reachable). This was the same failure pattern as the previous nights.

**Current limits and usage (post-restart snapshot):**

| Metric | Configured / seen | Read |
|---|---|---|
| DB connections | 14–16 of 60 | Low — no connection exhaustion right now |
| PgBouncer pool clients | 1 of 200 | Low |
| Memory | 54% used | Elevated but not saturated |
| Data disk | 12% of ~620 MB | Healthy |
| Slowest app query | 18 ms | Negligible — no slow-query problem |
| Longest transaction | 0.4 s | No hung transactions |

**No app-side offender found.** Top query volume since boot is Supabase platform-internal (realtime WAL polling). AAC's own queries are milliseconds. No idle-in-transaction buildup, no leak.

**Critical discovery — evidence is destroyed at each incident:** every log source (database, auth, API, function logs) was wiped at the 20:50 restart; retention only reaches ~10 minutes back around a restart. The logs from the previous two nights' outages are gone. This is why the root cause cannot be read out of stored history after the fact.

**One more symptom:** PostgREST logged "Warp server error: Thread killed by timeout manager" at 20:59 — the API layer was killing request threads during the recovery window.

## What this means for your six questions

1. **Which limit is reached** — cannot be proven from current data; the evidence was wiped. Connection count, memory, and disk are all healthy between incidents, so the limit is hit only at incident peaks.
2. **Configured limits vs peak** — configured: 60 DB connections, 200 pool clients. Peak at incident time: unknown (wiped).
3. **What consumes the capacity** — between incidents, nothing app-side; platform-internal processes dominate.
4. **Exhaustion / leak / CPU / slow queries** — no leak or slow-query evidence between incidents; incident-time state unknowable without capture.
5. **Why restart helps** — a restart resets the saturated resource (connections/memory) and re-initializes the instance; it does not remove whatever drives the resource to the limit.
6. **Permanent fix** — not determinable yet; requires incident-time evidence.

## Plan (read-only unless you approve each step)

### Step 1 — Report to Lovable support with hard evidence
Use your drafted message, updated with these facts: database restart confirmed 2026-09-25 20:50:42 UTC; three consecutive days of "Database limit reached"; log retention wiped at each restart (so only they can see host-level metrics); current healthy-baseline numbers (16/60 connections, 54% memory, 12% disk, no slow queries). Ask specifically which limit fired and why the instance restarts.

### Step 2 — Incident-time evidence runbook (read-only, no approval needed)
When you report the next outage, within minutes I run a fixed read-only capture before the ~10-minute log window closes: DB health snapshot, live connection breakdown by source, database/auth/API logs, and API-layer timeout entries. This converts the next incident from "restart cleared it" to an actual root-cause reading.

### Step 3 — Optional, needs your explicit approval
A tiny database-side recorder (a scheduled job sampling connection and memory state into one small table every minute) would capture the peak automatically, even if you're not watching. It writes only to a new diagnostic table — no email, no app behavior change. I will not create it without your explicit go-ahead.

### Explicitly not doing
No code changes, no schema changes, no capacity resize, no backend restart, no emails — until the root cause is identified and you authorize the fix.
