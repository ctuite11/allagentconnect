# Restore sign-in on allagentconnect.com

## What's wrong
Your account isn't the issue. The backend isn't responding right now: a health check just timed out, and no sign-in attempts are reaching the login service. That's why the page spins. This matches the earlier alert that the database had used up its disk read/write budget on the smallest (Tiny) size.

## Steps
1. Restart the backend. It takes a few minutes, and no data, accounts, or settings change.
2. Recheck health and try a sign-in for chris@allagentconnect.com without changing your password or account.
3. If it's still not responding or slows down again, offer the upgrade from Tiny to Mini (about 18.56 extra credits a month if it runs all the time). That change would go through its own approval card first.
4. Afterwards, look for the scheduled background jobs that were adding load. Any change to them would need your approval first.

## Not included
No emails, password resets, preference changes, or code changes.
