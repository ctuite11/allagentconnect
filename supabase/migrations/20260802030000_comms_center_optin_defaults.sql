-- Comms Center permanent opt-in policy: column defaults flip to FALSE.
--
-- BRANCH-ONLY migration. Not applied to production in this change.
--
-- Policy: new agents start with every Communications Center email channel OFF.
-- A missing notification_preferences row means all Comms Center email is off.
-- Existing rows are intentionally NOT updated here (no data change).

ALTER TABLE public.notification_preferences
  ALTER COLUMN buyer_need           SET DEFAULT false,
  ALTER COLUMN renter_need          SET DEFAULT false,
  ALTER COLUMN sales_intel          SET DEFAULT false,
  ALTER COLUMN general_discussion   SET DEFAULT false,
  ALTER COLUMN client_needs_enabled SET DEFAULT false,
  ALTER COLUMN new_matches_enabled  SET DEFAULT false;

COMMENT ON TABLE public.notification_preferences IS
  'Communications Center preferences. Opt-in only: defaults are FALSE and a missing row means all Comms Center email is disabled for that agent.';
