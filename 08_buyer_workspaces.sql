-- 08_buyer_workspaces.sql
-- AAC Migration Import
-- Run in Supabase SQL Editor AFTER applying schema migrations

-- buyer_workspaces (1 rows)
INSERT INTO public.buyer_workspaces (id, owner_id, created_at) VALUES
  ('a0cc1864-924f-46e3-bc39-b574b32d820d', '4520f31d-d3a7-4b93-b582-6dde0ec3313c', '2026-03-04 16:16:30.537674+00')
ON CONFLICT DO NOTHING;


-- buyer_workspace_members (1 rows)
INSERT INTO public.buyer_workspace_members (id, workspace_id, user_id, role, created_at) VALUES
  ('995c7ebe-e5cd-4cf5-bbc8-2fbbf14d6aa8', 'a0cc1864-924f-46e3-bc39-b574b32d820d', '4520f31d-d3a7-4b93-b582-6dde0ec3313c', 'owner', '2026-03-04 16:16:30.537674+00')
ON CONFLICT DO NOTHING;


-- buyer_workspace_invites (1 rows)
INSERT INTO public.buyer_workspace_invites (id, token, workspace_id, agent_id, created_by_user_id, buyer_email, buyer_first_name, buyer_last_name, buyer_user_id, accepted_at, accepted_by_user_id, expires_at, created_at, last_resent_at) VALUES
  ('53cdfb40-abb0-48c0-a550-ff48d672ebbc', '8b05a70d39bd01d49137dfdb6bf5e4cab8c783896afa678eeaf4340e55a6bb20', 'a0cc1864-924f-46e3-bc39-b574b32d820d', '1fc50da1-2664-4931-8cab-64e24dc5ed8c', '4520f31d-d3a7-4b93-b582-6dde0ec3313c', 'tuite.chris@gmail.com', 'dddd', 'ddddd', NULL, NULL, NULL, '2026-04-04 20:04:36.735083+00', '2026-03-05 20:04:36.735083+00', NULL)
ON CONFLICT DO NOTHING;

