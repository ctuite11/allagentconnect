CREATE TABLE IF NOT EXISTS public.listing_reminder_log (
  listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'stale-listing',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.listing_reminder_log TO service_role;

ALTER TABLE public.listing_reminder_log ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: this table is service-role only,
-- written and read by the send-stale-listing-reminders edge function.

CREATE OR REPLACE FUNCTION public.update_listing_reminder_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_listing_reminder_log_updated_at ON public.listing_reminder_log;
CREATE TRIGGER trg_listing_reminder_log_updated_at
  BEFORE UPDATE ON public.listing_reminder_log
  FOR EACH ROW EXECUTE FUNCTION public.update_listing_reminder_log_updated_at();