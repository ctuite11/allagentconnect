-- Add 'other' to client types check constraint
ALTER TABLE public.clients
DROP CONSTRAINT IF EXISTS client_type_check;

ALTER TABLE public.clients
ADD CONSTRAINT client_type_check 
CHECK (client_type IS NULL OR client_type IN ('buyer', 'seller', 'renter', 'agent', 'lender', 'attorney', 'inspector', 'other'));