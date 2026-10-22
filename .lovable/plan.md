# Boston matching fix: test only, no rollout

Approved scope: local tests and no-send checks. Deployment is a separate approval, after you see the results.

## 1. Undo the untested change first
- Restore the shared matching rule to its exact current live version, so nothing untested goes live.
- Check the file matches the live original, with no other differences.

## 2. Local tests only (no database, no email)
Keep the proposed version in a separate test-only copy that the email functions never use, and test it there:
- Saved Boston / Suffolk + Boston, MA post with no county → match.
- Different town (e.g. Cambridge, no county) → no match.
- Both sides list a county and they differ → no match.
- Different state, same town name → no match.
- All existing matching tests must still pass.

## 3. Full impact check (read-only code review)
- List every notification function that uses the shared matching rule, including seller alerts, and say for each whether the change would affect it.
- Flag the older function that writes a rate-limit record even in a dry run. It's excluded from all checks below.

## 4. Your eligibility, checked against real data (read-only)
Using read-only database reads plus the proposed rule run locally, for recent Boston Buyer Needs, confirm each step for chris@allagentconnect.com:
- Role, verified and activated status, and the hidden-account exception.
- Both master switches and the four channel switches.
- Location (with and without the fix), price (your $1M minimum) and property type.
- No email blocks or unsubscribes, plus the immediate delivery setting.
- Final result: would you have received it?

The same read-only method will list exactly which other agents would newly qualify, by name and count. No live functions are called, so nothing can be queued.

## 5. Proof nothing was sent
Read-only counts of the email queue and Communications records before and after, which must be identical.

## Report, then stop
You'll get the results for steps 2–5. Deployment needs your separate approval.
