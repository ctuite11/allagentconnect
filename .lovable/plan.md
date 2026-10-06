# Active incident: database unavailable, member sign-in failing

## Evidence captured (20:45–20:56 UTC, read-only)
- **Sign-in is failing on allagentconnect.com.** Sign-in requests returned 504 timeouts at 20:52:16 and 20:52:27, then 500 errors at 20:52:15 and 20:52:42. The 20:52:42 error was "failed to connect to database". All came from the live site.
- **The database is starved, not down.** Even trivial lookups take 12+ seconds; one settings read took 12.2s at 20:52:43. Statement timeouts repeated at 20:46, 20:51 and 20:53. One query ran for 710 seconds, finishing at 20:47:46.
- **Scheduled work is backing up.** At 20:48 jobs 2, 6, 11 and 12 failed with "job startup timeout", the same symptom as the Oct 5 outage. At 20:49 email-queue and Hot Sheet triggers took 63s each, the listing-status trigger 35s and the capacity sampler 90s; each normally takes well under a second.
- **Connections are dropping.** "Connection reset by peer" appeared at 20:47 and 20:53.
- **Health readings are unavailable.** The backend status check reports the database unreachable. The only alert on record is the disk read/write budget warning at 17:09 UTC, value 15, which was 48 at 13:04.
- **Recorder:** the last saved sample was at 20:32 UTC. The index exists, and history covers Sep 29 to Oct 6, about 7 days.

**Reading:** everything is slow at once, including trivial reads, while memory and connections were normal earlier. That fits disk read/write throttling once the budget ran out. It does not look like one bad query from AAC. Lovable support has to confirm this.

## Recommended next step (needs your approval)
1. **Restart the database now to restore sign-in.** The evidence above is already captured for support. Expect a few minutes of downtime.
2. Right after the restart, check: the backend reports healthy, a test sign-in works on the live site, and scheduled jobs run with normal timings again. All read-only.
3. Report the results and add the evidence above to your support message.

**Important caveat:** a restart clears the backlog, but it may not restore the disk read/write budget. If the slowdown returns soon, the real fix is a larger database server, which comes with a bigger read/write allowance. That would be a separate decision for you, and I would ask first.

## Not doing
No application, schema or schedule changes. No emails, publishing or resizing without separate approval.
