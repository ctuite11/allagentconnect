Delete the untracked file `supabase/migrations/20260523120000_archive_buyer_agent_conversations_on_remove.sql`.

No migration will be applied. No tracking-only row will be added. DB behavior is already live and correct via the existing `archive_conversations_between_users` function and the wired `agent_end_client_relationship` / `agent_end_client_relationship_by_id` functions.