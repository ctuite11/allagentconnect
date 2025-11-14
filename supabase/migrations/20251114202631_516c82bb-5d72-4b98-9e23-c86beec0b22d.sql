-- Add array column to store multiple property types for client needs
ALTER TABLE public.client_needs
ADD COLUMN IF NOT EXISTS property_types public.property_type[];