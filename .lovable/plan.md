# "Save to contacts? → No" fails on Create Hot Sheet: trace and proposed fix

Read-only trace. Nothing has been changed, sent, or deleted.

## What the trace found

1. **Where the temporary contact is created.** In `CreateHotSheetDialog.tsx` (`handleAddClientWithoutSaving`), clicking **No** adds the person to Selected Contacts with a made-up ID, `temp-<timestamp>`. Then it shows "Contact added to this hot sheet (not saved to your contacts list)".
2. **Where it breaks.** When you click Create Hot Sheet (`handleCreate`), the Hot Sheet row saves first. Then every selected contact's ID goes into the Hot Sheet's contact links (`hot_sheet_clients.client_id`). That field only accepts real contact IDs, so `temp-…` is rejected and you see the error. The Hot Sheet row is saved just before this step, so a failed attempt can leave a Hot Sheet with no contacts behind.
3. **Historical behavior: this path has never worked.** The **No** option and the `temp-` ID both arrived in one commit, `f923e69e` (2025-11-14, message "Changes"). Nothing ever turned that temporary person into something the database can store. The links table has required a real contact since it was created (2025-11-14).
   - The only special handling ever added was in May 2026 (`423593b6`, removed again in `6cb157ef`). It skipped `temp-` people when sending invites, but never when saving the contact links.
   - So this is a gap that was there from the start, not something recent work broke. There is no "previous behavior" to restore.
4. **The existing way to put someone on a Hot Sheet without a CRM contact** is the Hot Sheet email-subscriber list (`hot_sheet_subscribers`, added March 2026). It is email-only and needs no account or contact. Subscribers get new-match emails on the Hot Sheet's schedule and can unsubscribe.
   - It does **not** give them a buyer dashboard, the "Send First Batch & Invite" flow, or a buyer relationship. Those all need a real contact.

## Decision needed

Since no working behavior ever existed, choosing **No** needs a defined result. Options:

- **A. Recommended: attach as an email subscriber.** On Create, people added with **No** are saved to the Hot Sheet's subscriber list instead of the contact links.
  - They get match emails per the Hot Sheet's schedule.
  - They are not added to CRM contacts and get no buyer invite or dashboard.
  - Note: once the Hot Sheet is active, this means automatic match emails can go to that address.
- **B. Hot Sheet only, no delivery.** Keep the **No** choice, but make it clear the person won't be attached until saved as a contact. This mostly removes what **No** does, which you asked me not to do.
- **C. Save as a contact anyway.** Ruled out by you.

## Proposed fix (Option A, smallest change)

In `handleCreate` only:
- Split Selected Contacts into real contacts and `temp-` people.
- Insert real contacts into the contact links exactly as today.
- Insert `temp-` people into the subscriber list (Hot Sheet, agent, email, first and last name). If the email is already an active subscriber on that sheet, skip it instead of failing.
- If the subscriber insert fails, show the error the same way the contact-link failure does today.

Also:
- The success message after **No** changes to say they'll get match emails but aren't saved to contacts.
- No change to the **Yes** path, the dialog, the picker, Edit, invites, matching, templates, the email queue, or any other contact path.
- The confirmation step and the buyer-opened (locked) flow are unchanged. A locked buyer is always a real contact.

## Regression tests

These go in the existing Hot Sheet contact test file:
- A **No**-path person never reaches the contact links with a `temp-` ID.
- A **No**-path person goes to the subscriber list with the right email and name.
- A mix of real and **No**-path people splits correctly.
- The **Yes** path behaves exactly as before.

Then run the full Hot Sheet/contact suite and type-check.

## Out of scope

No emails, invites, or sends during the work. No matching, waiting-batch, template, or other contact-flow changes. No cleanup of any empty Hot Sheets left by failed attempts unless you ask for it separately.
