DO $$
DECLARE ids uuid[];
BEGIN
  SELECT array_agg(id) INTO ids
  FROM public.listings
  WHERE status = 'active'
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc');

  IF ids IS NULL THEN RETURN; END IF;

  DELETE FROM public.favorite_price_history WHERE listing_id = ANY(ids);
  DELETE FROM public.favorites WHERE listing_id = ANY(ids);
  DELETE FROM public.hot_sheet_comments WHERE listing_id = ANY(ids);
  DELETE FROM public.hot_sheet_favorites WHERE listing_id = ANY(ids);
  DELETE FROM public.hot_sheet_listing_status WHERE listing_id = ANY(ids);
  DELETE FROM public.hot_sheet_notifications WHERE listing_id = ANY(ids);
  DELETE FROM public.hot_sheet_sent_listings WHERE listing_id = ANY(ids);
  DELETE FROM public.listing_price_history WHERE listing_id = ANY(ids);
  DELETE FROM public.listing_reminder_log WHERE listing_id = ANY(ids);
  DELETE FROM public.listing_shares WHERE listing_id = ANY(ids);
  DELETE FROM public.listing_stats WHERE listing_id = ANY(ids);
  DELETE FROM public.listing_status_history WHERE listing_id = ANY(ids);
  DELETE FROM public.listing_views WHERE listing_id = ANY(ids);
  DELETE FROM public.off_market_views WHERE listing_id = ANY(ids);
  DELETE FROM public.showing_requests WHERE listing_id = ANY(ids);
  DELETE FROM public.agent_sent_listings WHERE listing_id = ANY(ids);
  DELETE FROM public.agent_messages WHERE listing_id = ANY(ids);
  DELETE FROM public.conversations WHERE listing_id = ANY(ids);
  UPDATE public.agent_early_access SET listing_id = NULL WHERE listing_id = ANY(ids);

  DELETE FROM public.listings WHERE id = ANY(ids);
END $$;