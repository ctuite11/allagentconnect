-- Rate limiting table for durable, atomic rate limiting across cold starts
CREATE TABLE public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, window_start)
);

-- Index for cleanup queries
CREATE INDEX idx_rate_limits_updated_at ON public.rate_limits (updated_at);

-- RPC function for atomic rate limit consumption
CREATE OR REPLACE FUNCTION public.rate_limit_consume(
  p_key text,
  p_window_seconds int,
  p_limit int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start timestamptz;
  v_current_count int;
  v_reset_at timestamptz;
  v_allowed boolean;
  v_remaining int;
BEGIN
  -- Calculate current window start (truncate to window boundary)
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + (p_window_seconds || ' seconds')::interval;

  -- Atomic upsert: increment count or insert new record
  INSERT INTO public.rate_limits (key, window_start, count, updated_at)
  VALUES (p_key, v_window_start, 1, now())
  ON CONFLICT (key, window_start)
  DO UPDATE SET
    count = public.rate_limits.count + 1,
    updated_at = now()
  RETURNING count INTO v_current_count;

  -- Determine if request is allowed
  v_allowed := v_current_count <= p_limit;
  v_remaining := GREATEST(0, p_limit - v_current_count);

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'reset_at', v_reset_at,
    'current_count', v_current_count
  );
END;
$$;

-- Cleanup function to remove old rate limit entries (older than 1 hour)
CREATE OR REPLACE FUNCTION public.rate_limits_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE updated_at < now() - interval '1 hour';
END;
$$;

-- Revoke direct table access from anon and authenticated
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- Grant execute on RPC to anon and authenticated
GRANT EXECUTE ON FUNCTION public.rate_limit_consume(text, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limits_cleanup() TO service_role;