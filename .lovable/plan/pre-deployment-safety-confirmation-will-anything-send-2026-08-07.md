# Pre-deployment safety confirmation — will anything send?

## What I verified just now (read-only)

- `email_jobs` contains **zero** queued/pending rows: 10,959 sent, 178 failed, 327 cancelled. Nothing is waiting to go out.
- Active crons: `process-email-queue-every-minute` (jobid 2), `process-comms-digests` (jobid 9), plus non-email jobs (listing statuses, auth deletion queue). Hot Sheet / price-change / message / stale-listing crons are inactive.

## Straight answer

Deploying the coverage-matching fix, by itself, sends **no emails**. The change only affects how the audience is computed *at the moment a new broadcast is created*. It:

- writes nothing to `email_jobs`,
- touches no sent history, dedup rows, or digest items,
- does not replay or reprocess the six Aug 4–7 broadcasts,
- and with the queue empty there is nothing for the worker to pick up.

One honest caveat: the system is currently **live** (email pauses are off, worker and digest crons active). So after deployment, the *next* Communications broadcast someone creates will send — and it will now correctly reach the ~12 previously suppressed agents. That is the intended fix, not a side effect. Nothing historical goes out.

## Options for deployment

1. **Deploy live (recommended).** No emails fire from the deploy itself. The fix takes effect on the next new broadcast.
2. **Deploy under pause.** Set the email pause switches on, deploy the five functions, verify with a dry-run, then lift the pauses. Zero possibility of any send during the window, at the cost of briefly holding all outbound email.

## Functions to redeploy (unchanged from the approved plan)

`notify-agents`, `notify-agents-client-need`, `send-client-need-notification`, `send-seller-alert`, `process-comms-digests`.

No migration, no data changes, no historical resend.
