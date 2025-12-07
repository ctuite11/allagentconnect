-- Change default from true to false for both columns
ALTER TABLE notification_preferences 
  ALTER COLUMN has_no_min SET DEFAULT false,
  ALTER COLUMN has_no_max SET DEFAULT false;

-- Update all existing records where both are true and no prices set (reset to unchecked)
UPDATE notification_preferences 
SET has_no_min = false, has_no_max = false 
WHERE has_no_min = true AND has_no_max = true 
  AND min_price IS NULL AND max_price IS NULL;