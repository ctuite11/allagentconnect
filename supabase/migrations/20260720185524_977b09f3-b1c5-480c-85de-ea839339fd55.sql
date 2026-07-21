ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_non_draft_requires_pricing_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_non_draft_requires_pricing_check
  CHECK (
    status = 'draft'
    OR (
      listing_type = 'for_rent'
      AND COALESCE(price, 0) > 0
    )
    OR (
      COALESCE(listing_type, 'for_sale') <> 'for_rent'
      AND (
        COALESCE(price, 0) > 0
        OR (
          COALESCE(price_range_min, 0) > 0
          AND COALESCE(price_range_max, 0) > 0
        )
      )
    )
  ) NOT VALID;

COMMENT ON CONSTRAINT listings_non_draft_requires_pricing_check ON public.listings IS
  'Non-draft for_sale/private_sale require price>0 or both range ends>0; for_rent requires price>0 (monthly rent). NOT VALID — legacy rows audited separately; VALIDATE after cleanup.';