-- Add city and state columns to client_needs table
ALTER TABLE client_needs 
ADD COLUMN city TEXT,
ADD COLUMN state TEXT;