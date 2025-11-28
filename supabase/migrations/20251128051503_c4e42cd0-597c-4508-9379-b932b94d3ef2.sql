-- Add share_count column to listing_stats
ALTER TABLE listing_stats ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;

-- Create listing_shares table to track all share actions
CREATE TABLE IF NOT EXISTS listing_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  shared_by uuid,
  share_type text NOT NULL,
  recipient_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_listing_shares_listing_id ON listing_shares(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_shares_created_at ON listing_shares(created_at);

-- Create trigger function to update share_count
CREATE OR REPLACE FUNCTION update_listing_share_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO listing_stats (listing_id, share_count)
  VALUES (NEW.listing_id, 1)
  ON CONFLICT (listing_id)
  DO UPDATE SET 
    share_count = listing_stats.share_count + 1,
    updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_listing_shared_update_stats ON listing_shares;
CREATE TRIGGER on_listing_shared_update_stats
AFTER INSERT ON listing_shares
FOR EACH ROW
EXECUTE FUNCTION update_listing_share_count();

-- Enable RLS
ALTER TABLE listing_shares ENABLE ROW LEVEL SECURITY;

-- RLS policies for listing_shares
DROP POLICY IF EXISTS "Anyone can insert shares" ON listing_shares;
CREATE POLICY "Anyone can insert shares"
ON listing_shares
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Agents can view shares for their listings" ON listing_shares;
CREATE POLICY "Agents can view shares for their listings"
ON listing_shares
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM listings
    WHERE listings.id = listing_shares.listing_id
    AND listings.agent_id = auth.uid()
  )
);