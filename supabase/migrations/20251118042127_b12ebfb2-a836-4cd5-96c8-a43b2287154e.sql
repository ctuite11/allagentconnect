-- Secure delete for draft listings with cascading cleanup
create or replace function public.delete_draft_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ensure the caller owns the listing and it is a draft
  if not exists (
    select 1 from public.listings
    where id = p_listing_id
      and agent_id = auth.uid()
      and status = 'draft'
  ) then
    raise exception 'Not authorized to delete this listing or listing is not a draft';
  end if;

  -- Delete dependent rows that may block deletion due to FK constraints
  delete from public.favorite_price_history where listing_id = p_listing_id;
  delete from public.favorites where listing_id = p_listing_id;
  delete from public.listing_status_history where listing_id = p_listing_id;
  delete from public.listing_views where listing_id = p_listing_id;
  delete from public.hot_sheet_listing_status where listing_id = p_listing_id;
  delete from public.hot_sheet_notifications where listing_id = p_listing_id;
  delete from public.hot_sheet_sent_listings where listing_id = p_listing_id;
  delete from public.hot_sheet_favorites where listing_id = p_listing_id;
  delete from public.hot_sheet_comments where listing_id = p_listing_id;
  delete from public.showing_requests where listing_id = p_listing_id;
  delete from public.agent_messages where listing_id = p_listing_id;
  delete from public.listing_stats where listing_id = p_listing_id;

  -- Finally delete the listing
  delete from public.listings where id = p_listing_id;
end;
$$;

-- Allow authenticated users to call the function (authorization is enforced inside)
grant execute on function public.delete_draft_listing(uuid) to authenticated;