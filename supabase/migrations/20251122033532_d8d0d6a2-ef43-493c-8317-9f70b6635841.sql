-- Add town column to listings table for more granular location data
ALTER TABLE listings 
ADD COLUMN town text;

COMMENT ON COLUMN listings.town IS 'Town/municipality name for more specific location data';