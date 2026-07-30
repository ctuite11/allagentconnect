-- Emergency email pause: stop the sender and all email producers.
SELECT cron.alter_job(jobid, active := false)
FROM cron.job
WHERE jobname IN (
  'process-email-queue-every-minute',
  'send-new-match-notification-every-15-min',
  'process-pending-message-emails',
  'send-price-change-notification-every-15-min',
  'send-stale-listing-reminders-daily',
  'process-comms-digests'
);