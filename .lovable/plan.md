# Confirm the cause of the "high load" message (read-only)

## What is already confirmed
- The message comes from Lovable Cloud's database **disk read/write budget** alert, not from AAC's code.
- A fresh check right now shows a new, worse alert: **21:14 UTC today, budget at 0** (earlier: 48 at 13:04, 15 at 17:09). The budget is being drained through the day.
- Everything else is healthy: 13 of 60 connections, memory 57%, disk space 12%, no restarts since boot.

So the alert is confirmed. What is **not** yet confirmed is *what is using up the read/write budget*.

## Read-only checks to confirm the cause
1. Rank database work by total volume (slowest/heaviest queries since the last restart), separating AAC queries from platform-internal ones (live updates, scheduler).
2. Check which tables are read and written the most (rows scanned, rows written, table and index sizes), including the scheduler history table and the every-minute capacity recorder.
3. List all scheduled jobs and how often they run; estimate disk work per job per hour.
4. Look at the capacity recorder samples around 13:04, 17:09 and 21:14 for spikes in activity.
5. Check background functions and email/Hot Sheet queue activity in the same windows.

## What you will get
A short report naming the top contributor(s) to the read/write budget, with numbers, labelled as confirmed or likely, plus options (e.g. slow a job down, add an index, or ask Lovable for a larger budget) — **no changes made** without your approval.

## Not doing
No writes, restarts, resizing, schedule changes, emails, or publishing.
