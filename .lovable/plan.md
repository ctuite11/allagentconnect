## Confirmed scope
Wipe Communications Center data in the live Supabase database. No schema, code, or frontend changes.

## Execution (FK-safe order)
Run via the insert tool (DELETE statements):

1. `DELETE FROM conversation_messages`
2. `DELETE FROM conversation_participants`
3. `DELETE FROM conversations`
4. `DELETE FROM client_agent_messages`
5. `DELETE FROM agent_messages`
6. `DELETE FROM agent_notifications`
7. `DELETE FROM hot_sheet_notifications`
8. `DELETE FROM comms_broadcasts`

## Not cleared (out of scope)
Email history/analytics (`email_jobs`, `email_sends`, `email_events`, `email_opens`, `email_clicks`), `hot_sheet_comments`, lead/match data (`client_needs`, `seller_matches`, `agent_match_*`), `invite_events`, `audit_logs`.

## Verification
`SELECT count(*)` on all 8 tables — expect 0 for each. Report results back.

## Risk
Destructive and irreversible. All existing inbox threads, message history, and in-app notifications disappear for every user.
