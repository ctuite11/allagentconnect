-- Step 1 of critical remediation (2026-07-20).
-- Drop the four blanket "Anyone with token can ..." policies on
-- public.hot_sheet_listing_status. They used USING (true) / WITH CHECK (true)
-- with no token check at all, so anonymous visitors could freely read, insert,
-- update, and delete every row.
--
-- The existing authenticated owner policies remain untouched, and no
-- application flow (authenticated buyer HotSheetReview, authenticated agent
-- Hot Sheet review, or the public shared HotSheetPreview page) reads or
-- writes this table anonymously.

DROP POLICY IF EXISTS "Anyone with token can view status"   ON public.hot_sheet_listing_status;
DROP POLICY IF EXISTS "Anyone with token can insert status" ON public.hot_sheet_listing_status;
DROP POLICY IF EXISTS "Anyone with token can update status" ON public.hot_sheet_listing_status;
DROP POLICY IF EXISTS "Anyone with token can delete status" ON public.hot_sheet_listing_status;

-- Defence in depth: remove blanket table grants to the anon role.
-- RLS already blocks them, but revoking the grant makes the intent explicit.
REVOKE ALL ON TABLE public.hot_sheet_listing_status FROM anon;