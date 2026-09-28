ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS draft_intended_status text NULL;
ALTER TABLE public.listings ADD CONSTRAINT chk_listings_draft_intended_status CHECK (
  draft_intended_status IS NULL OR draft_intended_status IN (
    'active','coming_soon','off_market','back_on_market','price_change','extended','reactivated',
    'under_agreement','pending','contingent','sold','rented','temporarily_withdrawn','cancelled','expired'
  )
);
COMMENT ON COLUMN public.listings.draft_intended_status IS 'Agent-selected status to apply on publish while listing is still a draft. Canonical DB value; cleared on publish.';