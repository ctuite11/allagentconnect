CREATE TABLE public.comms_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('buyer_need','sales_intel','renter_need','general_discussion')),
  subject text NOT NULL,
  message text NOT NULL,
  criteria jsonb,
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comms_broadcasts_cat_created ON public.comms_broadcasts(category, created_at DESC);
CREATE INDEX idx_comms_broadcasts_sender ON public.comms_broadcasts(sender_id);

GRANT SELECT, INSERT ON public.comms_broadcasts TO authenticated;
GRANT ALL ON public.comms_broadcasts TO service_role;

ALTER TABLE public.comms_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated agents can read broadcasts"
  ON public.comms_broadcasts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Senders insert their own broadcasts"
  ON public.comms_broadcasts FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());