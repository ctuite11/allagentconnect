-- 03_counties_flags.sql
-- AAC Migration Import
-- Run in Supabase SQL Editor AFTER applying schema migrations

-- counties (10 rows)
INSERT INTO public.counties (id, name, state, created_at) VALUES
  ('8bcde8c1-955f-4b81-ac6d-ee0872a36b38', 'Suffolk', 'MA', '2025-10-27 23:13:16.294634+00'),
  ('f0e05b4b-2389-4d82-9b02-c389fb8155d0', 'Norfolk', 'MA', '2025-10-27 23:13:16.294634+00'),
  ('d978edad-ec65-499d-9515-7b5507a57b5b', 'Middlesex', 'MA', '2025-10-27 23:13:16.294634+00'),
  ('19114d88-a82d-4445-99ab-626365d3d276', 'Essex', 'MA', '2025-10-27 23:13:16.294634+00'),
  ('92d60657-0bec-4b97-9e2e-977ab4d35c17', 'Worcester', 'MA', '2025-10-27 23:13:16.294634+00'),
  ('8a87156d-1dda-4ef8-a414-b3ec7ce6063c', 'Plymouth', 'MA', '2025-10-27 23:13:16.294634+00'),
  ('e7464bd2-970e-47d2-8aa5-a96d521d4e24', 'Bristol', 'MA', '2025-10-27 23:13:16.294634+00'),
  ('3c7d6436-e409-4839-a29d-ee61da21c040', 'Hampden', 'MA', '2025-10-27 23:13:16.294634+00'),
  ('f46e116d-7ffc-4ea6-a5ee-3a1409b5541e', 'Barnstable', 'MA', '2025-10-27 23:13:16.294634+00'),
  ('b765bb34-2721-4dce-88e1-488fe4246921', 'Hampshire', 'MA', '2025-10-27 23:13:16.294634+00')
ON CONFLICT DO NOTHING;


-- feature_flags (1 rows)
INSERT INTO public.feature_flags (id, flag_name, enabled, description, created_at, updated_at) VALUES
  ('54cc1e45-9900-4175-bf60-1c4f7945c59b', 'FEATURE_AGENT_PROPOSALS', TRUE, 'Gates buyer/seller agent proposal feature. When false, all proposal logic is dormant.', '2026-02-01 18:28:33.628757+00', '2026-02-04 01:31:28.190097+00')
ON CONFLICT DO NOTHING;

