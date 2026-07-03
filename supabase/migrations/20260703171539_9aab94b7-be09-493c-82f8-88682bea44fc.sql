
CREATE TABLE public.feature_flag_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (flag_name, user_id)
);

GRANT SELECT ON public.feature_flag_users TO authenticated;
GRANT ALL ON public.feature_flag_users TO service_role;

ALTER TABLE public.feature_flag_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage feature flag allowlist"
  ON public.feature_flag_users
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can see their own allowlist entries"
  ON public.feature_flag_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS feature_flag_users_flag_user_idx
  ON public.feature_flag_users (flag_name, user_id);

CREATE OR REPLACE FUNCTION public.is_feature_enabled(p_flag_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(
      (SELECT enabled FROM public.feature_flags WHERE flag_name = p_flag_name),
      false
    )
    OR EXISTS (
      SELECT 1
      FROM public.feature_flag_users
      WHERE flag_name = p_flag_name
        AND user_id = auth.uid()
    );
$function$;
