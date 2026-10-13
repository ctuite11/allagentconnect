ALTER TABLE public.hot_sheets ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;
ALTER TABLE public.hot_sheets ADD COLUMN IF NOT EXISTS draft_state jsonb;
CREATE INDEX IF NOT EXISTS idx_hot_sheets_drafts_by_user ON public.hot_sheets (user_id) WHERE is_draft;

-- Drafts are never active and never carry a contact; only finalize_hot_sheet may clear is_draft.
CREATE OR REPLACE FUNCTION public.hot_sheet_draft_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_draft AND NOT NEW.is_draft
     AND coalesce(current_setting('aac.finalizing_hot_sheet', true), '') <> NEW.id::text THEN
    RAISE EXCEPTION 'Drafts can only be finished with Create Hot Sheet' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'UPDATE' AND NOT OLD.is_draft AND NEW.is_draft THEN
    RAISE EXCEPTION 'An existing Hot Sheet cannot become a draft' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.is_draft THEN
    NEW.is_active := false;
    NEW.client_id := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS aaa_hot_sheets_draft_guard ON public.hot_sheets;
CREATE TRIGGER aaa_hot_sheets_draft_guard BEFORE INSERT OR UPDATE ON public.hot_sheets
FOR EACH ROW EXECUTE FUNCTION public.hot_sheet_draft_guard();

CREATE OR REPLACE FUNCTION public.hot_sheet_block_draft_recipients()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.hot_sheets WHERE id = NEW.hot_sheet_id AND is_draft) THEN
    RAISE EXCEPTION 'Draft Hot Sheets cannot have contacts or buyer batches' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS hot_sheet_clients_block_draft ON public.hot_sheet_clients;
CREATE TRIGGER hot_sheet_clients_block_draft BEFORE INSERT OR UPDATE ON public.hot_sheet_clients
FOR EACH ROW EXECUTE FUNCTION public.hot_sheet_block_draft_recipients();
DROP TRIGGER IF EXISTS hot_sheet_recipient_batches_block_draft ON public.hot_sheet_recipient_batches;
CREATE TRIGGER hot_sheet_recipient_batches_block_draft BEFORE INSERT OR UPDATE ON public.hot_sheet_recipient_batches
FOR EACH ROW EXECUTE FUNCTION public.hot_sheet_block_draft_recipients();

-- Drafts never create Communications Center buyer needs (function body unchanged).
DROP TRIGGER IF EXISTS sync_hot_sheet_to_client_needs_trigger ON public.hot_sheets;
CREATE TRIGGER sync_hot_sheet_to_client_needs_trigger AFTER INSERT OR UPDATE ON public.hot_sheets
FOR EACH ROW WHEN (NOT NEW.is_draft) EXECUTE FUNCTION public.sync_hot_sheet_to_client_needs();

-- All-or-nothing activation of a draft (or a brand-new sheet). SECURITY INVOKER: normal RLS applies.
CREATE OR REPLACE FUNCTION public.finalize_hot_sheet(
  p_hot_sheet_id uuid,
  p_user_id uuid,
  p_name text,
  p_criteria jsonb,
  p_sheet_type text,
  p_client_ids uuid[] DEFAULT '{}',
  p_client_id uuid DEFAULT NULL,
  p_notify_agent_email boolean DEFAULT true,
  p_notify_client_email boolean DEFAULT false,
  p_notification_schedule text DEFAULT 'immediately'
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_draft boolean;
  v_cid uuid;
  v_clients uuid[] := coalesce(p_client_ids, '{}');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Please enter a hot sheet name' USING ERRCODE = 'P0001';
  END IF;
  IF p_sheet_type IS NULL OR p_sheet_type NOT IN ('personal', 'buyer') THEN
    RAISE EXCEPTION 'Choose Personal or For a Buyer' USING ERRCODE = 'P0001';
  END IF;
  IF p_criteria IS NULL OR jsonb_typeof(p_criteria) <> 'object' THEN
    RAISE EXCEPTION 'Criteria are required' USING ERRCODE = 'P0001';
  END IF;
  IF p_sheet_type = 'personal' AND (cardinality(v_clients) > 0 OR p_client_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Personal Hot Sheets cannot have contacts' USING ERRCODE = 'P0001';
  END IF;

  IF p_hot_sheet_id IS NULL THEN
    INSERT INTO public.hot_sheets (user_id, client_id, name, criteria, is_active, is_draft,
      notify_client_email, notify_agent_email, notification_schedule, sheet_type)
    VALUES (p_user_id, p_client_id, btrim(p_name), p_criteria, true, false,
      p_notify_client_email, p_notify_agent_email, p_notification_schedule, p_sheet_type)
    RETURNING id INTO v_id;
  ELSE
    SELECT id, is_draft INTO v_id, v_draft FROM public.hot_sheets WHERE id = p_hot_sheet_id FOR UPDATE;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Draft not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_draft THEN
      RETURN v_id; -- already finished: repeat call is a no-op
    END IF;
    PERFORM set_config('aac.finalizing_hot_sheet', v_id::text, true);
    UPDATE public.hot_sheets SET
      name = btrim(p_name), criteria = p_criteria, sheet_type = p_sheet_type,
      client_id = p_client_id, is_draft = false, is_active = true, draft_state = NULL,
      notify_client_email = p_notify_client_email, notify_agent_email = p_notify_agent_email,
      notification_schedule = p_notification_schedule
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Draft not found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM set_config('aac.finalizing_hot_sheet', '', true);
  END IF;

  FOREACH v_cid IN ARRAY v_clients LOOP
    IF NOT EXISTS (SELECT 1 FROM public.hot_sheet_clients WHERE hot_sheet_id = v_id AND client_id = v_cid) THEN
      INSERT INTO public.hot_sheet_clients (hot_sheet_id, client_id) VALUES (v_id, v_cid);
    END IF;
  END LOOP;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.finalize_hot_sheet(uuid, uuid, text, jsonb, text, uuid[], uuid, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_hot_sheet(uuid, uuid, text, jsonb, text, uuid[], uuid, boolean, boolean, text) TO authenticated;