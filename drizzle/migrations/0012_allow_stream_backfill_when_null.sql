CREATE OR REPLACE FUNCTION public.email_jobs_stream_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stream IS DISTINCT FROM OLD.stream THEN
    -- Allow a one-way backfill of a NULL stream to the canonical stream for
    -- the job's template (repair of rows inserted before the template was
    -- mapped). Any other change remains forbidden.
    IF OLD.stream IS NULL
       AND NEW.stream IS NOT NULL
       AND NEW.stream = public.email_stream_for_template(NEW.payload->>'template')
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'email_jobs.stream is immutable after insertion';
  END IF;
  RETURN NEW;
END;
$$;