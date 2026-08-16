DO $$
DECLARE v_claims int; v_jobs int;
BEGIN
  SELECT count(*) INTO v_claims FROM public.hot_sheet_delivery_claims
   WHERE listing_id='11111111-1111-1111-1111-111111111111';
  SELECT count(*) INTO v_jobs FROM public.email_jobs;
  ASSERT v_claims = 1, format('concurrent duplicate events must yield exactly 1 claim, got %s', v_claims);
  ASSERT v_jobs = 0, format('paused concurrent delivery must create 0 jobs, got %s', v_jobs);
  ASSERT (SELECT state FROM public.hot_sheet_delivery_claims
           WHERE listing_id='11111111-1111-1111-1111-111111111111') = 'paused_held',
    'the winning claim must be paused_held';
  RAISE NOTICE 'CONCURRENCY ASSERTIONS PASSED (1 claim, 0 jobs)';
END $$;
