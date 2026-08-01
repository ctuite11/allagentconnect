DO $$
DECLARE
  v_deleted_ids uuid[];
  v_count int;
BEGIN
  WITH del AS (
    DELETE FROM public.email_jobs
    WHERE payload->'metadata'->>'broadcast_id' = '8e255ea5-f218-4c80-aaf1-a6f09e85dfee'
      AND payload->>'template' = 'client-need-broadcast'
      AND status = 'queued'
    RETURNING id
  )
  SELECT array_agg(id) INTO v_deleted_ids FROM del;

  v_count := coalesce(array_length(v_deleted_ids, 1), 0);

  IF v_count <> 132 THEN
    RAISE EXCEPTION 'ABORT: expected exactly 132 target queued rows, got %. Rolling back.', v_count;
  END IF;

  RAISE NOTICE 'Deleted % target queued client-need-broadcast jobs. IDs: %', v_count, v_deleted_ids;
END $$;