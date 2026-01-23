-- Ticket 3: Performance indexes for high-traffic queries
-- Targeted composite indexes aligned with common filter/sort patterns

-- =============================================
-- LISTINGS INDEXES
-- =============================================

-- Pagination: recency feed (created_at desc, id desc for stable pagination)
CREATE INDEX IF NOT EXISTS idx_listings_created_at_id
ON public.listings (created_at DESC, id DESC);

-- Status filtering with recency sort (active/pending/sold feeds)
CREATE INDEX IF NOT EXISTS idx_listings_status_created_at
ON public.listings (status, created_at DESC);

-- City + status filter with recency (location-based searches)
CREATE INDEX IF NOT EXISTS idx_listings_city_status_created_at
ON public.listings (city, status, created_at DESC);

-- Zip code + status filter with recency (zip-based searches)
CREATE INDEX IF NOT EXISTS idx_listings_zip_status_created_at
ON public.listings (zip_code, status, created_at DESC);

-- Price range queries (min/max price filters)
CREATE INDEX IF NOT EXISTS idx_listings_price
ON public.listings (price);

-- State + status for broader geographic searches
CREATE INDEX IF NOT EXISTS idx_listings_state_status_created_at
ON public.listings (state, status, created_at DESC);

-- =============================================
-- AGENT PROFILES INDEXES
-- =============================================

-- Pagination: recency feed
CREATE INDEX IF NOT EXISTS idx_agent_profiles_created_at_id
ON public.agent_profiles (created_at DESC, id DESC);

-- State-based agent directory
CREATE INDEX IF NOT EXISTS idx_agent_profiles_office_state_created_at
ON public.agent_profiles (office_state, created_at DESC);

-- =============================================
-- CLIENT NEEDS INDEXES
-- =============================================

-- Recency feed for client needs dashboard
CREATE INDEX IF NOT EXISTS idx_client_needs_created_at
ON public.client_needs (created_at DESC);

-- Submitter's needs lookup
CREATE INDEX IF NOT EXISTS idx_client_needs_submitted_by_created_at
ON public.client_needs (submitted_by, created_at DESC);

-- State-based matching
CREATE INDEX IF NOT EXISTS idx_client_needs_state_created_at
ON public.client_needs (state, created_at DESC);

-- =============================================
-- FAVORITES INDEXES
-- =============================================

-- User's favorites lookup
CREATE INDEX IF NOT EXISTS idx_favorites_user_id_created_at
ON public.favorites (user_id, created_at DESC);

-- Listing favorites count
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id
ON public.favorites (listing_id);

-- =============================================
-- HOT SHEETS INDEXES
-- =============================================

-- Owner's hot sheets (user_id is the agent who created it)
CREATE INDEX IF NOT EXISTS idx_hot_sheets_user_id_created_at
ON public.hot_sheets (user_id, created_at DESC);

-- Client's hot sheets
CREATE INDEX IF NOT EXISTS idx_hot_sheets_client_id_created_at
ON public.hot_sheets (client_id, created_at DESC);

-- Active hot sheets for notification processing
CREATE INDEX IF NOT EXISTS idx_hot_sheets_is_active
ON public.hot_sheets (is_active)
WHERE is_active = true;

-- =============================================
-- EMAIL QUEUE INDEXES (for worker efficiency)
-- =============================================

-- Worker claim query optimization (partial index for queued jobs)
CREATE INDEX IF NOT EXISTS idx_email_jobs_status_run_after_created_at
ON public.email_jobs (status, run_after, created_at)
WHERE status = 'queued';

-- =============================================
-- RATE LIMITS CLEANUP INDEX
-- =============================================

-- For cleanup job to efficiently find old entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_updated_at
ON public.rate_limits (updated_at);