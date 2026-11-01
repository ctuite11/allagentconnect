-- SECURE LISTING SHARE LINKS (STAGED - NOT APPLIED).
-- Raw token is shown once to the sharing agent; only its SHA-256 hash is stored.
-- Signed-out recipients can read exactly one listing (safe fields) + the sharing agent's contact card.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.listing_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash bytea NOT NULL UNIQUE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  recipient_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '90 days',
  revoked_at timestamptz
);
CREATE INDEX listing_share_links_creator_idx ON public.listing_share_links(created_by);
REVOKE ALL ON public.listing_share_links FROM PUBLIC, anon;
GRANT SELECT ON public.listing_share_links TO authenticated;
GRANT ALL ON public.listing_share_links TO service_role;
ALTER TABLE public.listing_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents see their own share links" ON public.listing_share_links
  FOR SELECT TO authenticated USING (created_by = auth.uid());

-- Create: verified agents only, public-status listings only. Returns the raw token ONCE.
CREATE FUNCTION public.create_listing_share_link(p_listing_id uuid, p_recipient_label text DEFAULT NULL, p_days integer DEFAULT 90)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE raw text;
BEGIN
  IF NOT public.is_verified_agent() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501'; END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN RAISE EXCEPTION 'invalid_expiry'; END IF;
  IF NOT EXISTS (SELECT 1 FROM listings l WHERE l.id = p_listing_id AND public.is_public_listing_status(l.status)) THEN
    RAISE EXCEPTION 'listing_not_shareable';
  END IF;
  raw := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  INSERT INTO listing_share_links(token_hash, listing_id, created_by, recipient_label, expires_at)
  VALUES (digest(raw, 'sha256'), p_listing_id, auth.uid(), left(p_recipient_label, 120), now() + make_interval(days => p_days));
  RETURN raw;
END $$;

CREATE FUNCTION public.revoke_listing_share_link(p_link_id uuid)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH u AS (UPDATE listing_share_links SET revoked_at = now()
             WHERE id = p_link_id AND created_by = auth.uid() AND revoked_at IS NULL RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$$;

-- Internal: resolve a raw token to a live link (valid, unrevoked, listing still public, sharer still verified).
CREATE FUNCTION public._resolve_listing_share(p_token text)
RETURNS public.listing_share_links LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
  SELECT k.* FROM listing_share_links k
  JOIN listings l ON l.id = k.listing_id
  JOIN agent_settings s ON s.user_id = k.created_by
  WHERE p_token IS NOT NULL AND length(p_token) BETWEEN 40 AND 60
    AND k.token_hash = digest(p_token, 'sha256')
    AND k.revoked_at IS NULL AND k.expires_at > now()
    AND public.is_public_listing_status(l.status)
    AND s.agent_status = 'verified'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public._resolve_listing_share(text) FROM PUBLIC, anon, authenticated;

-- Public read: one listing, explicit safe columns only; no listing agent internals, no photo URLs.
CREATE FUNCTION public.get_shared_listing(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'listing', jsonb_build_object('id', l.id, 'status', l.status, 'address', l.address, 'city', l.city,
       'state', l.state, 'price', l.price, 'bedrooms', l.bedrooms, 'bathrooms', l.bathrooms,
       'square_feet', l.square_feet, 'description', l.description,
       'photo_count', coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(l.photos)='array' THEN l.photos END), 0)),
    'agent', jsonb_build_object('first_name', p.first_name, 'last_name', p.last_name, 'company', p.company,
       'phone', coalesce(p.cell_phone, p.phone), 'email', p.email, 'headshot_url', p.headshot_url),
    'expires_at', k.expires_at)
  FROM public._resolve_listing_share(p_token) k
  JOIN listings l ON l.id = k.listing_id
  LEFT JOIN agent_profiles p ON p.id = k.created_by
  WHERE k.id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.create_listing_share_link(uuid, text, integer), public.revoke_listing_share_link(uuid), public.get_shared_listing(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_listing_share_link(uuid, text, integer), public.revoke_listing_share_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_listing(text) TO anon, authenticated;

-- Service-role only: photo storage paths for the photo edge function (Option B: token in POST body, never in image URL).
CREATE FUNCTION public.get_shared_listing_photo_paths(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT l.photos FROM public._resolve_listing_share(p_token) k JOIN listings l ON l.id = k.listing_id WHERE k.id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.get_shared_listing_photo_paths(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_listing_photo_paths(text) TO service_role;
