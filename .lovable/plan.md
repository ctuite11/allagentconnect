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

## Approved plan — Step 1 send, Step 2 ready, Step 3 build

### Step 1 — Escalation to Lovable support (approved, ready to send)
The finalized escalation message (restart at 2026-09-25 20:50:42 UTC, three consecutive days of "Database limit reached" alerts, logs wiped at each restart, healthy baseline numbers, seven specific questions) is ready. I have no direct channel to Lovable's infrastructure team, so Chris sends this message through Lovable support; it is fully drafted and matches the verified evidence.

### Step 2 — Incident-time evidence runbook (read-only, armed)
When the next outage is reported, within minutes I run a fixed read-only capture before the ~10-minute log window closes: DB health snapshot, live connection breakdown by source, database/auth/API logs, and API-layer timeout entries.

### Step 3 — Automatic evidence recorder (approved — build now)
Strictly diagnostic; capture the peak automatically instead of losing evidence at each restart:

- One new diagnostics table only (`public.db_capacity_samples`), plus GRANTs and RLS (service-role only; nothing readable by app users).
- One scheduled job sampling **once per minute** (1,440 samples/day). The samples table is capped (auto-pruned to ~7 days) so it stays a few MB.
- Each sample records: connections by state and source (application name/user), active vs idle count, longest transaction age, Postgres start time / uptime, plus any database-visible resource metrics available (memory-related settings, WAL size, database size).
- No app behavior changes, no email, no capacity changes, no restart automation, no reads by the application.

### Explicitly not doing
No code changes, no capacity resize, no backend restart, no emails, no restart automation — until the root cause is identified and a fix is authorized.
