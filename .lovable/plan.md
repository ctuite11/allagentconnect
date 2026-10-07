# Revert out-of-scope Agent Network changes; finish personal vs buyer Hot Sheet tests

The Agent Network work was out of scope. This plan reverts only the Agent Network changes made earlier in this session. The five approved contact-creation migrations and their tests stay exactly as they are. No sends, emails, invitations, matching changes, waiting-batch changes, or other feature work.

## 1. Revert the Agent Network changes (only these)

- **Database function:** remove `public.add_network_agent_contact`.
  - Read-only check, already done: nothing else in the database references it.
  - It was created only by this session's migration, `0031_add_network_agent_contact`.
  - The only code that calls it is the helper and card listed below.
- **Card:** restore the Agent Network card to its exact code from before this session.
- **Helper:** remove `addNetworkAgentContact`. It was added only for this exception.
- **Tests:** remove the two Agent Network-specific guard tests. The card goes back on the guard test's "pending decision" list, as it was before.

Two things I will not do:
- No Agent Network exception is added to `AGENTS.md`. None was ever added.
- No other Agent Network changes.

## 2. Personal vs buyer Hot Sheet tests (tests only)

- **Opened independently:** a Hot Sheet with zero contacts is allowed and saves.
- **Opened from a buyer:** that buyer remains attached and cannot be removed.

I'll re-run these tests and fix only the test setup if they fail. The dialogs and Hot Sheet behavior will not change.

## 3. Verify and report

I'll run the full Hot Sheet/contact test suite and the type-check, then report:
- exactly what was reverted;
- the final test results.

Then I'll stop.

## Technical details

- The card file is `src/components/agent-search/AgentMarketplaceCard.tsx`, restored from the last commit before this session.
- The helper is removed from `src/lib/agentContactResolver.ts`.
- The guard test is `src/lib/contactCreationPaths.test.ts`: the card goes back on `PENDING_DECISION`, and the two Agent Network tests are deleted.
- The function removal is a migration running `DROP FUNCTION IF EXISTS public.add_network_agent_contact(uuid);`.
- The personal vs buyer tests are in `src/components/__tests__/hotSheetContacts.test.tsx`.
