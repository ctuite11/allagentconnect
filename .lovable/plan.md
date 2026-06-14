## Plan

1. **Fix the query relationship**
   - Update `src/components/success-hub/networkActivity/useNewestVerifiedAgents.ts` so it queries verified rows from `agent_settings` and joins each row to `agent_profiles` through `agent_settings.user_id = agent_profiles.id`.
   - The current query starts from `agent_profiles` and assumes an embedded relationship that does not exist, so it returns no visible agents.

2. **Keep only verified agents**
   - Filter by `agent_status = 'verified'`.
   - Sort by `verified_at` newest first, with profile `created_at` as fallback ordering.

3. **Keep the UI unchanged**
   - Preserve the existing “Newest Verified Agents” row, cards, avatar rendering, and click-through behavior.
   - Map the joined profile data into the same shape the UI already expects.

## Technical detail

The database has `agent_settings.user_id`, not `agent_settings.agent_id`, and no foreign key/embed relationship is exposed for the current `agent_profiles -> agent_settings` query. A direct SQL check shows 8 verified agents exist when joined manually on `agent_settings.user_id = agent_profiles.id`, so the frontend query needs to be rewritten to match that actual relationship.