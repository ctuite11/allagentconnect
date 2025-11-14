-- Add client_type column to clients table
ALTER TABLE public.clients 
ADD COLUMN client_type text;

-- Add a check constraint to ensure only valid values
ALTER TABLE public.clients
ADD CONSTRAINT client_type_check 
CHECK (client_type IS NULL OR client_type IN ('buyer', 'seller', 'renter'));