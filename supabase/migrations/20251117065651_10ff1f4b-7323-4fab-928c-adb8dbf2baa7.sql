-- Fix commission_rate field to support larger flat fee amounts
-- Current NUMERIC(5,2) only supports values up to 999.99
-- Change to NUMERIC(10,2) to support flat fees up to $99,999,999.99
ALTER TABLE listings 
ALTER COLUMN commission_rate TYPE NUMERIC(10,2);