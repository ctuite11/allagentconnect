# "Save to contacts? → No": hidden contact, impact check and smallest plan

Read-only check only. No code, data, emails, invites, subscriber, matching, or batch changes.

## 1. Smallest schema change

Add one column to the contacts table, `clients`:

- `hidden_from_contacts boolean NOT NULL DEFAULT false`, a Hot-Sheet-only flag.
- Every existing contact stays visible (default `false`). It's additive only, with no rename and no backfill.

Add the same column to the shared contacts list view, `clients_with_relationship_status`. That view is defined as `c.*`-style columns from `clients`, so it means a one-line view replace.

Also extend the authoritative `resolve_or_create_agent_contact` function with one optional argument, `p_hidden boolean DEFAULT false`:

- **New contact:** the hidden flag is set to `p_hidden`.
- **Same agent, existing contact (hidden or visible):** reuse it, unchanged by a "No" call.
  - If the call is a normal save (`p_hidden = false`) and the existing contact is hidden, **promote** it to visible (see section 4).
- **Another member's email:** the same exact block message, with no change.
- Its locked SQL test gets new cases for hidden create, hidden reuse, and promotion.

## 2. Lists and searches that must exclude hidden contacts

There is good news on the main paths. My Clients and every contact picker load from **one shared loader** (`fetchAllAgentContacts` in `src/lib/contactSearch.ts`, reading the view above). One filter there (`hidden_from_contacts = false`) covers:

- My Clients page (list, search, counts on that page)
- Create Hot Sheet contact search and its preload
- Edit Hot Sheet contact search
- Create Buyer contact search
- The Share Listing, Share Multiple Listings, and Hot Sheet share-by-email pickers (`useAgentShareContactSearch`)

Separate queries that also need the filter:

- **Agent Dashboard:** total contacts count and the "recent contacts" list (`AgentDashboard.tsx` lines 204 and 270).
- **Success Hub:** the "new contacts in last 30 days" metric (`useSuccessHubData.ts` line 336).
- **Add Hot Sheet Recipient dialog:** its full contact list (`AddHotSheetRecipientDialog.tsx` line 69).
- **Admin agent drawer:** its per-agent contact list (`AgentEditDrawer.tsx` line 86). It's admin-only. I'd filter it or label hidden contacts as "Hot Sheet only". **Your call.**

## 3. Queries that must keep including hidden contacts

These all load a contact **by its ID** (or by attached-contact IDs), so they keep working with no change:

- Hot Sheet Review: recipients, primary buyer, send-recipient lookup (`HotSheetReview.tsx` lines 449, 742, 1026) and `resolveHotSheetReviewConversationBuyer`
- Edit Hot Sheet: attached contacts loaded through the `hot_sheet_clients` links
- Create Hot Sheet edit mode: attached contacts loaded through the links
- First-batch send / invite: `process-hot-sheet`, `enqueueHotSheetClientInvites`, `filterStaleInviteTokens`
- Buyer detail, buyer dashboard, buyer favorites, buyer new-match lookup, buyer workspace mirror
- Agent and client messaging functions, and `remove-buyer`
- Success Hub Buyers List and buyer table: they load by IDs taken from relationships, so a hidden contact who accepts an invite shows as a buyer there (see section 5)

Duplicate checks must also keep **including** hidden contacts, so a hidden record is reused, never duplicated:

- The resolver function itself
- Create Hot Sheet's email lookup (line 272)
- Create Buyer's existing-email check
- My Clients' existing-email check
- The import pre-check

## 4. Promotion from hidden to visible

- **Inside the resolver:** a normal save (Yes on "Save to contacts?", My Clients add, Create Buyer, import, share pickers' manual add) for an email that matches this agent's hidden contact sets `hidden_from_contacts = false` and returns the same contact ID.
  - No new row is created.
  - The Hot Sheet links, invites, and relationship stay attached to that same ID.
- **Same person added with "No" again:** the existing contact is reused as-is. A visible contact is never demoted to hidden.

## 5. Other places a hidden contact could show up

- **Accepted invite:** a hidden contact who accepts the Hot Sheet invite gets an active buyer relationship. They then appear wherever buyers appear (Success Hub buyers, Buyer Detail, messaging). I think that's correct, since they're now a real connected buyer. Promoting automatically on acceptance would be a separate decision, and it's **not** included here.
- **Reverse Prospect dialog:** loads by IDs it already has, so it shows a hidden contact only if one is already linked. Acceptable.
- **Admin Consumers:** looks up contacts by email for admin purposes. Hidden contacts stay included.
- **The agent can delete contacts on My Clients:** a hidden contact isn't listed there, so it can't be deleted from that page. It's removed by detaching it from the Hot Sheet, which is the same as today.
- **Edge functions:** none list contacts for display. All look up by ID or email for a specific action.

## Implementation steps (after approval)

1. **One migration:** add the column, refresh the view to include it, and add `p_hidden` plus promotion to `resolve_or_create_agent_contact`. Update its SQL test.
2. **`agentContactResolver.ts`:** add an optional `hidden` input.
3. **`CreateHotSheetDialog.tsx`, "No" path:** call the resolver with `hidden: true` and put the real returned ID in Selected Contacts. The `temp-` ID is removed, and nothing else in the dialog changes.
4. **Filters:** add the hidden filter to the shared loader plus the four separate queries listed in section 2.
5. **Tests:**
   - "No" never puts a `temp-` ID into the Hot Sheet links.
   - "No" calls the resolver with hidden set.
   - Yes and normal saves promote a hidden contact.
   - The shared loader excludes hidden contacts.
   - Then run the full Hot Sheet/contact suite and type-check.

## Out of scope

- No emails, invites, or sends; creating a Hot Sheet still sends nothing.
- No changes to subscribers, matching, waiting batches, or templates.
- No change to Yes, Edit's layout, the picker design, or the Agent Network card.
- The 14 existing zero-contact Hot Sheets are untouched.

## Open decisions for you

1. Admin agent drawer: hide hidden contacts, or show them labeled "Hot Sheet only"?
2. Accepted invite: should it auto-promote the contact to visible, now or later? (Not included by default.)
