SELECT cron.alter_job(jobid, active := false)
FROM cron.job
WHERE jobname IN (
  'process-email-queue-every-minute',
  'kick-email-queue',
  'process-pending-message-emails',
  'process-comms-digests',
  'send-new-match-notification-every-15-min',
  'send-price-change-notification-every-15-min',
  'send-stale-listing-reminders-daily'
);