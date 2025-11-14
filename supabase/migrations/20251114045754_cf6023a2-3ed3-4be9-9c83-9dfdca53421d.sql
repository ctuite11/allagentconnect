-- Add new notification preference columns to existing table
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS buyer_need BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS sales_intel BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS renter_need BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS general_discussion BOOLEAN NOT NULL DEFAULT false;