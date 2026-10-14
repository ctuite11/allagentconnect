# Restore sign-in (database not responding)

## What we know
- Sign-in attempts on allagentconnect.com since about 13:14 UTC are timing out. The sign-in service can't reach the database ("context deadline exceeded" and "failed to connect").
- Live database health readings are unavailable right now. Recent history shows a disk-speed budget alert at 01:02 UTC today (40% left).
- Your password and account have not changed. Sign-in, and anything else that needs the database, is down for everyone.

## Steps (each one needs your OK)
1. **Capture evidence first.** Read the last 10 minutes from the incident recorder that samples every minute. Note what was running and how many connections were open, so Lovable support gets a record.
2. **Restart the backend** to clear stuck connections. Nothing gets deleted. The site is unavailable for about 1–2 minutes.
3. **Confirm recovery.** Check that sign-in works on allagentconnect.com. Check that the email queue count is unchanged and nothing was sent or replayed.
4. **If it happens again**, propose a bigger database size or a fix for whatever the recorder shows is overloading it. No action without your approval.

## Safety
No emails, Hot Sheet sends, data changes, or code changes. Queued email stays exactly as it is.
