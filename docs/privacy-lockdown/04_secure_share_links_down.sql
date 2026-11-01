-- ROLLBACK: removes share links entirely (recipients see "link no longer valid"); reopens nothing to the public.
DROP FUNCTION IF EXISTS public.get_shared_listing_photo_paths(text), public.get_shared_listing(text),
  public._resolve_listing_share(text), public.revoke_listing_share_link(uuid), public.create_listing_share_link(uuid, text, integer);
DROP TABLE IF EXISTS public.listing_share_links;
