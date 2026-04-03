-- Migration 2: High Value — CHECK constraints

-- listings.status
ALTER TABLE public.listings
  ADD CONSTRAINT chk_listing_status
  CHECK (status IN ('draft','coming_soon','active','pending','under_contract','sold','cancelled','withdrawn','temporarily_withdrawn','off_market','expired','back_on_market'));

-- listings.property_type
ALTER TABLE public.listings
  ADD CONSTRAINT chk_listing_property_type
  CHECK (property_type IN ('single_family','condo','townhouse','multi_family','land','commercial','residential_rental','commercial_rental','apartment'));

-- email_jobs.status
ALTER TABLE public.email_jobs
  ADD CONSTRAINT chk_email_job_status
  CHECK (status IN ('queued','processing','sent','failed','cancelled'));

-- hot_sheet_comments.sender_role
ALTER TABLE public.hot_sheet_comments
  ADD CONSTRAINT chk_hot_sheet_comment_sender_role
  CHECK (sender_role IN ('agent','client'));