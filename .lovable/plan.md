# Phase 2 Complete: Agent Proposal Incentives UI

## Summary
Built a fully feature-flagged UI section in the Agent Profile Editor for managing agent proposal visibility and incentives. The entire section is gated behind `FEATURE_AGENT_PROPOSALS` (currently `false`).

## Completed Work

### Database Migration
- Added RLS policies to `agent_proposal_incentives`:
  - `Agents can read own incentives` (SELECT with `auth.uid() = agent_id`)
  - `Agents can insert own incentives` (INSERT with `WITH CHECK auth.uid() = agent_id`)
  - `Agents can update own incentives` (UPDATE with `USING` + `WITH CHECK` to prevent `agent_id` tampering)
- Existing admin policies preserved

### New Files Created
1. **`src/hooks/useFeatureFlag.ts`**
   - Module-level cache prevents repeated RPC calls
   - Returns `{ enabled, loading }` for any flag name
   - Zero queries if cached

2. **`src/hooks/useAgentProposalIncentives.ts`**
   - STRICT GUARD: Only executes queries when `featureEnabled === true`
   - Fetches `show_buyer_proposal` and `show_seller_proposal` from `agent_settings`
   - Fetches incentives from `agent_proposal_incentives` (maybeSingle)
   - ATOMIC SAVE: Both updates must succeed; shows error if either fails

3. **`src/components/proposals/AgentProposalIncentivesForm.tsx`**
   - UI for visibility toggles + incentives
   - Uses locked microcopy from `docs/proposal-system-copy.md`
   - Independent save flow with toast feedback

### Integration
- `src/pages/AgentProfileEditor.tsx` now conditionally renders the form after Social Media section
- Gated by `proposalsEnabled && userId`

## Security Guardrails
- ✅ Feature flag check happens first
- ✅ Zero queries when flag is false
- ✅ RLS enforces `agent_id = auth.uid()` on all operations
- ✅ WITH CHECK prevents agent_id tampering on UPDATE
- ✅ Admin access preserved (existing policy untouched)
- ✅ No public/consumer page changes
- ✅ No email triggers or background jobs
- ✅ Atomic save: success only if both updates succeed

## Testing Checklist
- [ ] With flag OFF: section does not appear, no network calls
- [ ] With flag ON: section appears, data loads correctly
- [ ] Toggle saves update `agent_settings` correctly
- [ ] Incentives save creates row if none exists (INSERT via upsert)
- [ ] Incentives save updates row if exists (UPDATE via upsert)
- [ ] Partial saves preserve unmodified fields
- [ ] Feature flag RPC called only once per session (cached)
- [ ] Error states show appropriate toast messages

## Next Steps (Phase 2 continued)
- [ ] Buyer Qualifications flow (docs upload, agreement modal, receive_agent_proposals toggle)
- [ ] Add listing commission fields to incentives (listing_commission_type, listing_commission_value)
