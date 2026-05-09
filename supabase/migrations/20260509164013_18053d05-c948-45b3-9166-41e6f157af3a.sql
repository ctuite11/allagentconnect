
CREATE TABLE public.email_job_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.email_jobs(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip_address text
);
CREATE INDEX idx_email_job_opens_job ON public.email_job_opens(job_id);
CREATE INDEX idx_email_job_opens_recipient ON public.email_job_opens(lower(recipient_email));
CREATE INDEX idx_email_job_opens_opened_at ON public.email_job_opens(opened_at);
ALTER TABLE public.email_job_opens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view opens" ON public.email_job_opens FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.email_job_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.email_jobs(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  url text NOT NULL,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip_address text
);
CREATE INDEX idx_email_job_clicks_job ON public.email_job_clicks(job_id);
CREATE INDEX idx_email_job_clicks_recipient ON public.email_job_clicks(lower(recipient_email));
ALTER TABLE public.email_job_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view clicks" ON public.email_job_clicks FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.email_unsubscribes (
  email_lower text GENERATED ALWAYS AS (lower(email)) STORED,
  email text NOT NULL,
  category text NOT NULL CHECK (category IN ('listing_shares','hot_sheet_alerts','marketing','all')),
  unsubscribed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'one_click' CHECK (source IN ('one_click','preference_page','complaint','admin')),
  PRIMARY KEY (email_lower, category)
);
CREATE INDEX idx_email_unsubscribes_email ON public.email_unsubscribes(email_lower);
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view unsubscribes" ON public.email_unsubscribes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.is_email_unsubscribed(_email text, _category text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.email_unsubscribes
    WHERE email_lower = lower(_email)
      AND category IN (_category, 'all')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_email_unsubscribed(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.v_email_job_engagement AS
SELECT
  j.id AS job_id,
  j.created_at,
  j.payload->>'template' AS template,
  j.payload->>'category' AS category,
  j.delivery_status,
  (SELECT COUNT(*) FROM public.email_job_opens o WHERE o.job_id = j.id) AS open_count,
  (SELECT COUNT(*) FROM public.email_job_clicks c WHERE c.job_id = j.id) AS click_count,
  (SELECT MIN(opened_at) FROM public.email_job_opens o WHERE o.job_id = j.id) AS first_opened_at,
  (SELECT MIN(clicked_at) FROM public.email_job_clicks c WHERE c.job_id = j.id) AS first_clicked_at
FROM public.email_jobs j;

CREATE OR REPLACE VIEW public.v_email_unsubscribes_status AS
SELECT
  email_lower AS email,
  array_agg(category ORDER BY category) AS categories,
  MIN(unsubscribed_at) AS first_unsubscribed_at,
  MAX(unsubscribed_at) AS last_unsubscribed_at
FROM public.email_unsubscribes
GROUP BY email_lower;
