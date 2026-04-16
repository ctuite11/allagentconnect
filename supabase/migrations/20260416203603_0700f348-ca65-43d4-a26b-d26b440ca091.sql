-- Normalize legacy 'draft' values to 'hidden'
UPDATE public.listings
SET dcmls_status = 'hidden'
WHERE dcmls_status = 'draft';

-- Backfill nulls to 'not_published' so the constraint can apply cleanly
UPDATE public.listings
SET dcmls_status = 'not_published'
WHERE dcmls_status IS NULL;

-- Add CHECK constraint for dcmls_status
ALTER TABLE public.listings
DROP CONSTRAINT IF EXISTS dcmls_status_check;

ALTER TABLE public.listings
ADD CONSTRAINT dcmls_status_check
CHECK (dcmls_status IN ('not_published','published','hidden','error'));