-- Add new columns to listings table for comprehensive listing information
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'for_sale' CHECK (listing_type IN ('for_sale', 'for_rent', 'for_private_sale')),
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'flat_fee')),
ADD COLUMN IF NOT EXISTS commission_notes TEXT,
ADD COLUMN IF NOT EXISTS showing_instructions TEXT,
ADD COLUMN IF NOT EXISTS lockbox_code TEXT,
ADD COLUMN IF NOT EXISTS appointment_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS showing_contact_name TEXT,
ADD COLUMN IF NOT EXISTS showing_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS disclosures JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS property_features JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS additional_notes TEXT;