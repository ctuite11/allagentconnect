ALTER TABLE public.email_unsubscribes DROP CONSTRAINT IF EXISTS email_unsubscribes_category_check;

ALTER TABLE public.email_unsubscribes
  ADD CONSTRAINT email_unsubscribes_category_check
  CHECK (category = ANY (ARRAY[
    'hot_sheet_alerts',
    'marketing',
    'account_reminders',
    'comms_broadcast',
    'comms_digest',
    'member_updates',
    'development_notifications',
    'listing_broadcast',
    'listing_shares',
    'all'
  ]));

COMMENT ON CONSTRAINT email_unsubscribes_category_check ON public.email_unsubscribes IS 'Must match VALID_CATEGORIES in supabase/functions/email-unsubscribe/index.ts';