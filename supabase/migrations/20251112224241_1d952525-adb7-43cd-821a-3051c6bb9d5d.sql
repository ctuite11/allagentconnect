-- Add neighborhood column to listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS neighborhood text;