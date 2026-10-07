# Agent Network exception + personal Hot Sheets

Scope is limited to the two decisions. The five contact-creation migrations and the 46 existing tests stay as they are. No sends, emails, invitation tests, matching changes, or waiting-batch changes. The 14 existing zero-contact Hot Sheets are not touched.

## Status before plan mode

Some of this was already applied earlier in this turn:
- Applied: a new database function `add_network_agent_contact`.
- Switched: the Agent Network card now calls that function.
- Added: guard tests for the Agent Network card. They have not been run yet.
- Written: personal vs buyer Hot Sheet tests. Their test run was cut off before it finished, so the results are unknown.

Everything still to do is listed below.

## 1. Agent Network card: narrow exception

Behavior:
- **Adding a known member:** "Add agent as contact" adds a known AAC agent member, identified by their member record. A typed email is never used.
- **Already a contact:** the existing contact is used and nothing new is created. The match is by member link or by email, ignoring capitalization.
- **Member details stay private:** the function returns only the contact id and whether it was newly created. The member's email is never returned to the screen.
- **Ordinary block unchanged:** every manually entered email keeps going through the ordinary rule and the exact block message.
- **Self-add rejected:** you can't add yourself as a contact.

Remaining work:
- Confirm whether the card should keep saving the agent's cell phone. The new function currently uses the member's profile phone. Either restore cell phone or accept profile phone, and report which.
- Run the guard tests and confirm two things: the card uses only the exception, and no other screen uses it.
- Add a database verification script that rolls back everything it creates and saves nothing permanently. It covers:
  - Adding a member creates one agent contact.
  - Adding the same member again returns the same contact.
  - Adding yourself is rejected.
  - The ordinary rule still blocks the same member's email when typed in manually.

## 2. Personal vs buyer Hot Sheets

There is no change to how the app behaves. The two cases below are only being locked with tests:
- **Opened independently:** the last contact can be removed, and saving creates the Hot Sheet with no contacts attached. This is a valid personal Hot Sheet.
- **Opened from a buyer:** the buyer has no Remove button, and saving attaches that buyer.

Remaining work:
- Re-run the new tests. Fix only the test setup if it needs it; the dialogs themselves will not be changed.

## 3. Verification and report

Run all Hot Sheet and contact-rule tests together, and the type-check. The report will give:
- the test count;
- the database verification result;
- the phone decision;
- confirmation that nothing was sent and the batches are untouched.

## Technical details

- Function: `public.add_network_agent_contact(p_member_id uuid)`.
  - Security definer.
  - Can be called only by signed-in users.
  - Looks up the member in `agent_profiles`.
  - Uses an advisory lock, then inserts with `ON CONFLICT DO NOTHING` and re-reads the row.
  - Saves the contact with `client_type='agent'`, `source='network'`, and `agent_user_id` set to the member.
- Frontend helper: `addNetworkAgentContact` in `src/lib/agentContactResolver.ts`.
- Tests:
  - `src/lib/contactCreationPaths.test.ts` contains the card-only exception guard.
  - `src/components/__tests__/hotSheetContacts.test.tsx` contains the personal vs buyer cases.
  - `supabase/tests/add_network_agent_contact.sql` (new) is the database verification script.
- `AGENTS.md`: add a one-line rule saying the Agent Network flow is the only exception, and that it works by member id.
