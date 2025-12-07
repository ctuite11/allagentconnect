-- Reset has_no_min to false where min_price is null
UPDATE notification_preferences 
SET has_no_min = false 
WHERE has_no_min = true AND min_price IS NULL;

-- Reset has_no_max to false where max_price is null  
UPDATE notification_preferences 
SET has_no_max = false 
WHERE has_no_max = true AND max_price IS NULL;