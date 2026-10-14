# Restore sign-in: Step 1 findings and Step 2 request

## Step 1 findings (evidence collected 13:28 UTC)
- **The database is unreachable.** The health check timed out, and direct connections were refused with "connection to database not available." Live readings could not be taken: connection counts, long-running queries, disk-speed metrics and the incident recorder's last 10 minutes are all stored inside the database. The recorder's samples are saved there and can be read once it's back up.
- **Timeline from the logs that are still available:**
  - 01:02 UTC: alert that the disk-speed budget was down to 40%.
  - 13:14 UTC: sign-ins start failing.
  - 13:19 UTC: a scheduled job failed to start in time, connections started dropping, and queries were cancelled for running too long.
  - 13:20 UTC: one query finished after running for **523 seconds (about 8.7 minutes)**.
  - After 13:20, nothing more was logged.
- **What it points to (not yet confirmed):** a very slow query, or the disk-speed budget running out, starved the database until it stopped accepting connections. October 12 looked similar.

## Will email and Hot Sheet senders resume on their own?
- **Yes.** The email sender and the Hot Sheet sender run automatically every minute. Both were still starting up at 13:20.
- Once the database is back, they **resume on their own**. They send only emails that were already waiting in the queue, plus normal new activity. They do not resend email that already went out, and they do not replay old events.
- While the database is down, I can't count or hold the waiting emails. If you want them held, the senders would have to be paused. That needs a database change, which you said not to make, so I'll leave them as they are unless you say otherwise.

## Step 2 (needs your approval)
1. Restart the backend. No data is deleted. Everything is unavailable for about 1–5 minutes.
2. Check every 30 seconds until it's healthy. Then confirm sign-in works on allagentconnect.com.
3. Right away, save the recorder's samples from 13:00 to 13:25, the slowest queries, and the connection and disk readings.
4. Report the queue counts before and after so you can see exactly what was sent.

## Step 3 (after service is back): fix the root cause
- Compare today with October 12: the recorder data, the slowest queries, and the disk-speed alerts.
- Identify the query that ran for 523 seconds and what triggered it.
- Propose a permanent fix for your approval. Depending on what the data shows, that could be a faster query or index, time limits on scheduled jobs, spreading out the jobs that run every minute, or a larger database. No changes without your OK.
