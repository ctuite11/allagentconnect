-- Add cumulative_active_days to listing_stats
ALTER TABLE public.listing_stats
ADD COLUMN cumulative_active_days integer NOT NULL DEFAULT 0;

-- Create function to calculate and update cumulative active days
CREATE OR REPLACE FUNCTION public.update_cumulative_active_days()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_days integer := 0;
  active_start timestamp with time zone;
  history_record RECORD;
BEGIN
  -- Only recalculate if status changed
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Calculate cumulative active days from status history
  FOR history_record IN 
    SELECT new_status, changed_at
    FROM public.listing_status_history
    WHERE listing_id = NEW.id
    ORDER BY changed_at ASC
  LOOP
    IF history_record.new_status = 'active' AND active_start IS NULL THEN
      -- Start of active period
      active_start := history_record.changed_at;
    ELSIF history_record.new_status != 'active' AND active_start IS NOT NULL THEN
      -- End of active period
      total_days := total_days + CEIL(EXTRACT(EPOCH FROM (history_record.changed_at - active_start)) / 86400);
      active_start := NULL;
    END IF;
  END LOOP;

  -- If currently active, add days from last active start to now
  IF active_start IS NOT NULL THEN
    total_days := total_days + CEIL(EXTRACT(EPOCH FROM (now() - active_start)) / 86400);
  END IF;

  -- Update listing_stats
  UPDATE public.listing_stats
  SET cumulative_active_days = total_days,
      updated_at = now()
  WHERE listing_id = NEW.id;

  RETURN NEW;
END;
$$;

-- Create trigger to update cumulative days on status change
CREATE TRIGGER update_cumulative_days_on_status_change
  AFTER INSERT OR UPDATE OF status ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cumulative_active_days();

-- Backfill cumulative_active_days for existing listings
DO $$
DECLARE
  listing_record RECORD;
  total_days integer;
  active_start timestamp with time zone;
  history_record RECORD;
BEGIN
  FOR listing_record IN SELECT id FROM public.listings LOOP
    total_days := 0;
    active_start := NULL;

    -- Calculate from status history
    FOR history_record IN 
      SELECT new_status, changed_at
      FROM public.listing_status_history
      WHERE listing_id = listing_record.id
      ORDER BY changed_at ASC
    LOOP
      IF history_record.new_status = 'active' AND active_start IS NULL THEN
        active_start := history_record.changed_at;
      ELSIF history_record.new_status != 'active' AND active_start IS NOT NULL THEN
        total_days := total_days + CEIL(EXTRACT(EPOCH FROM (history_record.changed_at - active_start)) / 86400);
        active_start := NULL;
      END IF;
    END LOOP;

    -- If currently active, add days to now
    IF active_start IS NOT NULL THEN
      total_days := total_days + CEIL(EXTRACT(EPOCH FROM (now() - active_start)) / 86400);
    END IF;

    -- Update the stat
    UPDATE public.listing_stats
    SET cumulative_active_days = total_days
    WHERE listing_id = listing_record.id;
  END LOOP;
END $$;