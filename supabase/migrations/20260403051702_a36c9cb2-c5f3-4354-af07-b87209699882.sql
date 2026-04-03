-- Migration 3: New columns + indexes

-- Add is_archived and is_muted to conversation_participants
ALTER TABLE public.conversation_participants
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN is_muted boolean NOT NULL DEFAULT false;

-- Composite index on hot_sheet_comments for faster lookups
CREATE INDEX IF NOT EXISTS idx_hot_sheet_comments_hs_listing
  ON public.hot_sheet_comments(hot_sheet_id, listing_id);