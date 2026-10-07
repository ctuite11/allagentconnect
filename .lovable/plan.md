# Personal vs buyer Hot Sheets: lock with tests

Scope is only the zero-contact distinction. The Agent Network card stays as it was before this work. The five contact-creation migrations and the 46 existing tests stay as they are. Nothing is sent, and there are no changes to matching, invitations, waiting batches, or the Agent Network. The 14 existing zero-contact Hot Sheets are not touched.

## 1. Undo the Agent Network changes made earlier this session

Before your out-of-scope decision arrived, I had already made four Agent Network changes. Each will be undone:
- **Card:** restore the Agent Network card exactly as it was before, using its original duplicate check and save.
- **Helper:** remove the unused `addNetworkAgentContact` helper.
- **Guard test:** remove the two Agent Network guard tests. The card goes back on the guard test's "pending decision" list, so the five migrated screens stay protected while the card is left alone.
- **Database function:** remove the unused `add_network_agent_contact` function, so it isn't left unused in your database. Removing it needs your yes/no approval when it runs.
  - Safeguard check, done read-only: no other database function or access rule references it. It was created only by this session's migration (`0031_add_network_agent_contact`). The only code that calls it is the helper and card being undone above.

I'll also record the Agent Network question as a separate, open item for later.

## 2. Lock personal vs buyer Hot Sheets

The app's behavior does not change. These are tests only:
- **Opened independently:** the last contact can be removed. Saving then creates the Hot Sheet with no contacts attached, which is a valid personal Hot Sheet.
- **Opened from a buyer:** the buyer has no Remove button and stays attached when saved.

These two tests are already written. Their first run was cut off, so I'll re-run them. If anything fails, I'll fix only the test setup, never the Create or Edit dialogs.

## 3. Verify and report

I'll run all Hot Sheet and contact-rule tests, plus the type-check. The report will include:
- the final test count;
- confirmation that the Agent Network card matches the original code exactly;
- confirmation that nothing was sent and both waiting batches are untouched.

## Technical details

- The card file is `src/components/agent-search/AgentMarketplaceCard.tsx`. It will be restored from the previous commit.
- The helper being removed is in `src/lib/agentContactResolver.ts`.
- The guard test is `src/lib/contactCreationPaths.test.ts`:
  - `PENDING_DECISION` goes back to `["components/agent-search/AgentMarketplaceCard.tsx"]`.
  - The two Agent Network tests are deleted.
- The function removal is a migration running `DROP FUNCTION IF EXISTS public.add_network_agent_contact(uuid);`.
- The personal vs buyer tests are in `src/components/__tests__/hotSheetContacts.test.tsx`, under the "personal vs buyer" section.
