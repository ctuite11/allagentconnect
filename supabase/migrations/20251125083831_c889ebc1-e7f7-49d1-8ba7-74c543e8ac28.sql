-- Add timing fields for Coming Soon and auto-activation
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS go_live_date date,
ADD COLUMN IF NOT EXISTS auto_activate_on timestamptz,
ADD COLUMN IF NOT EXISTS auto_activate_days integer;

COMMENT ON COLUMN listings.go_live_date IS 'Date when Coming Soon listing should become Active';
COMMENT ON COLUMN listings.auto_activate_on IS 'Exact datetime when listing should auto-activate to Active status';
COMMENT ON COLUMN listings.auto_activate_days IS 'Optional: Number of days from creation until auto-activation';