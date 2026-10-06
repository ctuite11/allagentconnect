# Audit: "heavy load" message and slow navigation (read-only)

Audit only. No code changes, deploys, emails, database writes, restarts, or resource changes.

## Findings so far (confirmed by reads this turn)

- **Not from the AAC app.** The words "heavy load" / "high load" do not appear anywhere in AAC's site code, backend functions, or Netlify functions. Live allagentconnect.com visitors never see that wording from AAC.
- **Most likely source: a Lovable Cloud warning in the Lovable editor**, based on a database resource alert. The database health snapshot shows one recent alert: **disk read/write budget below 50% (value 48) at 13:04 UTC today**.
- **Current state is healthy:** database up, memory 69%, disk space 13%, 33 of 60 connections, no restarts.
- **Biggest background database load:** the scheduled status jobs (auto-activate, expiration, open houses) have each run about 15,200 times, adding up to about 4.2 minutes of database time. The "verified agent IDs" lookup is slow: about 250 ms per call, up to 1.2 s.
- **Worth explaining:** about 238,000 rolled-back database transactions since the last restart.

## What the remaining audit will check (all read-only)

1. Confirm the exact wording and where the message appeared (Lovable editor banner vs. page). This fixes whether the source is Lovable's own warning about the database or something else.
2. Check how often each status job runs and whether it reads the whole listings table each time. This is the main candidate for draining the disk budget around 13:04.
3. Find which calls cause the rolled-back transactions, using backend function logs and analytics.
4. Check the cost of the "verified agent IDs" lookup and which pages call it.
5. Compare the 13:04 alert time with traffic and with the navigation timings. Each Success Hub Back adds about 46 requests per agent, which adds to the load but on its own is unlikely to set off the alert.
6. Classify the cause: Lovable platform condition vs. AAC's own workload, and whether live users can feel it (shared database, so yes when it is under pressure).

## Deliverable

A short report covering: the trigger, the source service, its link to slow navigation, the top load contributors, temporary vs. AAC-specific, and live-site impact. It ends with ranked safe fixes for approval; none are applied. Lovable support is still needed to confirm the exact alert metric and threshold.
