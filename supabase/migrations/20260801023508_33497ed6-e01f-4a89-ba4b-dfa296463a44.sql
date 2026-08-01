-- Restore only non-Hot-Sheet email schedules.
SELECT cron.alter_job(jobid, active := true)
FROM cron.job
WHERE jobname IN (
  'process-email-queue-every-minute',
  'process-pending-message-emails',
  'process-comms-digests'
);

-- Explicitly keep every Hot Sheet / listing-email schedule inactive.
SELECT cron.alter_job(jobid, active := false)
FROM cron.job
WHERE jobname IN (
  'send-new-match-notification-every-15-min',
  'send-price-change-notification-every-15-min',
  'send-stale-listing-reminders-daily'
);

-- === ROLLBACK NOTES ===
-- SELECT cron.alter_job(jobid, active := false) FROM cron.job
--   WHERE jobname IN ('process-email-queue-every-minute','process-pending-message-emails','process-comms-digests');