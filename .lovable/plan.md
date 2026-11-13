# Restore login (database unreachable again)

## What I found (read-only)
- The backend health check timed out: the database is not responding, so sign-in can't work for anyone.
- This matches the Nov 4 outage. The database used up its disk read/write allowance.

## Plan once you approve
1. Restart the database. The site is briefly unavailable and no data is deleted.
2. Wait for it to come back, then confirm sign-in and the Success Hub work for chris@allagentconnect.com.
3. Report memory, connections and disk read/write use, plus what was running when it stalled.
4. Make no other changes: no Mini upgrade, no changes to scheduled jobs, no emails.

## Permanent fix (still waiting on your decision)
The Nov 4 proposal (fewer every-minute background tasks, plus monitoring) has not been approved or applied, so these outages will keep happening. After the restart, reply with your answers to its decisions A to D, or approve the Mini upgrade (about +18 to 19 credits/month).
