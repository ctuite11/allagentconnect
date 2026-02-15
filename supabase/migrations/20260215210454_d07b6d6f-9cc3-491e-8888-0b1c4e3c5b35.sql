
ALTER TABLE hot_sheet_comments
  ADD COLUMN sender_role text NOT NULL DEFAULT 'client',
  ADD COLUMN sender_id uuid;

ALTER PUBLICATION supabase_realtime ADD TABLE hot_sheet_comments;
