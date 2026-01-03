-- Add is_favorite column to clients table
ALTER TABLE public.clients 
ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;