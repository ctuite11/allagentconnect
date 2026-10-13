ALTER TABLE public.hot_sheets ADD COLUMN IF NOT EXISTS sheet_type text;
ALTER TABLE public.hot_sheets ADD CONSTRAINT hot_sheets_sheet_type_check CHECK (sheet_type IS NULL OR sheet_type IN ('personal','buyer'));
COMMENT ON COLUMN public.hot_sheets.sheet_type IS 'personal = agent-only, never has contacts/batches/invites (enforced by triggers); buyer = buyer workflow; NULL = legacy sheet, unchanged behavior until the agent picks a type.';

CREATE OR REPLACE FUNCTION public.hot_sheet_block_personal_recipients()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.hot_sheets WHERE id = NEW.hot_sheet_id AND sheet_type = 'personal') THEN
    RAISE EXCEPTION 'Personal Hot Sheets cannot have contacts, invitations or buyer batches' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER hot_sheet_clients_block_personal BEFORE INSERT OR UPDATE ON public.hot_sheet_clients
FOR EACH ROW EXECUTE FUNCTION public.hot_sheet_block_personal_recipients();
CREATE TRIGGER hot_sheet_recipient_batches_block_personal BEFORE INSERT OR UPDATE ON public.hot_sheet_recipient_batches
FOR EACH ROW EXECUTE FUNCTION public.hot_sheet_block_personal_recipients();

CREATE OR REPLACE FUNCTION public.hot_sheet_guard_personal_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sheet_type = 'personal' AND (TG_OP = 'INSERT' OR OLD.sheet_type IS DISTINCT FROM 'personal') THEN
    IF NEW.client_id IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.hot_sheet_clients WHERE hot_sheet_id = NEW.id)
       OR EXISTS (SELECT 1 FROM public.hot_sheet_recipient_batches WHERE hot_sheet_id = NEW.id) THEN
      RAISE EXCEPTION 'Remove contacts and buyer batches before making this a Personal Hot Sheet' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF NEW.sheet_type = 'personal' AND NEW.client_id IS NOT NULL THEN
    RAISE EXCEPTION 'Personal Hot Sheets cannot have a contact' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER hot_sheets_guard_personal_type BEFORE INSERT OR UPDATE OF sheet_type, client_id ON public.hot_sheets
FOR EACH ROW EXECUTE FUNCTION public.hot_sheet_guard_personal_type();

REVOKE EXECUTE ON FUNCTION public.hot_sheet_block_personal_recipients() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hot_sheet_guard_personal_type() FROM PUBLIC, anon, authenticated;