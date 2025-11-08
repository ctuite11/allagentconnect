-- Add residential_rental and commercial_rental to property_type enum
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'residential_rental';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'commercial_rental';

-- Make county_id nullable in buyer_needs table
ALTER TABLE buyer_needs ALTER COLUMN county_id DROP NOT NULL;