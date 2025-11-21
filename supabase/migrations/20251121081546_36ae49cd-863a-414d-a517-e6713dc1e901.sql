-- Drop and recreate the delete_draft_listing function with better error handling
DROP FUNCTION IF EXISTS public.delete_draft_listing(uuid);

CREATE OR REPLACE FUNCTION public.delete_draft_listing(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_listing RECORD;
BEGIN
  -- Get the listing details for better error messages
  SELECT id, agent_id, status, address
  INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id;
  
  -- Check if listing exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found with ID: %', p_listing_id;
  END IF;
  
  -- Check ownership
  IF v_listing.agent_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to delete this listing. You do not own this listing.';
  END IF;
  
  -- Check status (case-insensitive)
  IF LOWER(v_listing.status) != 'draft' THEN
    RAISE EXCEPTION 'Cannot delete listing with status "%". Only draft listings can be deleted. Address: %', v_listing.status, v_listing.address;
  END IF;
  
  -- Delete dependent rows that may block deletion due to FK constraints
  DELETE FROM public.favorite_price_history WHERE listing_id = p_listing_id;
  DELETE FROM public.favorites WHERE listing_id = p_listing_id;
  DELETE FROM public.listing_status_history WHERE listing_id = p_listing_id;
  DELETE FROM public.listing_views WHERE listing_id = p_listing_id;
  DELETE FROM public.hot_sheet_listing_status WHERE listing_id = p_listing_id;
  DELETE FROM public.hot_sheet_notifications WHERE listing_id = p_listing_id;
  DELETE FROM public.hot_sheet_sent_listings WHERE listing_id = p_listing_id;
  DELETE FROM public.hot_sheet_favorites WHERE listing_id = p_listing_id;
  DELETE FROM public.hot_sheet_comments WHERE listing_id = p_listing_id;
  DELETE FROM public.showing_requests WHERE listing_id = p_listing_id;
  DELETE FROM public.agent_messages WHERE listing_id = p_listing_id;
  DELETE FROM public.listing_stats WHERE listing_id = p_listing_id;
  
  -- Finally delete the listing
  DELETE FROM public.listings WHERE id = p_listing_id;
  
  RAISE NOTICE 'Successfully deleted draft listing: %', p_listing_id;
END;
$$;