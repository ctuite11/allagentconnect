CREATE TABLE public.developer_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_name text NOT NULL,
  website text,
  project_name text,
  market text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  source text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  provisioned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provisioned_account_id uuid REFERENCES public.development_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT developer_access_requests_status_check
    CHECK (status IN ('pending','approved','declined'))
);

CREATE UNIQUE INDEX developer_access_requests_pending_email_uniq
  ON public.developer_access_requests (lower(email))
  WHERE status = 'pending';

CREATE INDEX developer_access_requests_status_created_idx
  ON public.developer_access_requests (status, created_at DESC);

GRANT SELECT, UPDATE ON public.developer_access_requests TO authenticated;
GRANT ALL ON public.developer_access_requests TO service_role;

ALTER TABLE public.developer_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view developer access requests"
  ON public.developer_access_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update developer access requests"
  ON public.developer_access_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_developer_access_requests_updated_at
  BEFORE UPDATE ON public.developer_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.admin_decide_developer_access_request(
  _request_id uuid,
  _decision text,
  _notes text DEFAULT NULL
) RETURNS public.developer_access_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row public.developer_access_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  IF _decision NOT IN ('declined','pending') THEN
    RAISE EXCEPTION 'decision must be declined or pending (use admin_approve_developer_access_request to approve)';
  END IF;

  UPDATE public.developer_access_requests
     SET status = _decision,
         review_notes = COALESCE(_notes, review_notes),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   WHERE id = _request_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'request not found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_developer_access_request(
  _request_id uuid,
  _owner_user_id uuid,
  _account_name text DEFAULT NULL,
  _account_slug text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req public.developer_access_requests;
  v_account_id uuid;
  v_name text;
  v_slug text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT * INTO v_req FROM public.developer_access_requests WHERE id = _request_id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'request not found';
  END IF;
  IF v_req.status = 'approved' THEN
    RAISE EXCEPTION 'request already approved';
  END IF;
  IF _owner_user_id IS NULL THEN
    RAISE EXCEPTION 'owner user id is required';
  END IF;

  v_name := COALESCE(NULLIF(btrim(_account_name), ''), v_req.company_name);
  v_slug := COALESCE(
    NULLIF(btrim(_account_slug), ''),
    regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')
  );
  v_slug := btrim(v_slug, '-');

  v_account_id := public.create_development_account(v_name, v_slug, _owner_user_id, NULL, v_req.email);

  UPDATE public.developer_access_requests
     SET status = 'approved',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_notes = COALESCE(_notes, review_notes),
         provisioned_user_id = _owner_user_id,
         provisioned_account_id = v_account_id
   WHERE id = _request_id;

  RETURN v_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_decide_developer_access_request(uuid, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_approve_developer_access_request(uuid, uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_developer_access_request(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_developer_access_request(uuid, uuid, text, text, text) TO authenticated, service_role;