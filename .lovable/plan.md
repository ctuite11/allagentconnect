# Two small fixes

## 1. Change default Founding Partner email subject

In `src/components/BulkEmailDialog.tsx` (line 208), the default subject auto-filled when the "Founding Partner — Exclusive Invitation" template is chosen is currently:

> "Become a Founding Partner | All Agent Connect"

Change it to:

> **"Founding Partner Invite | All Agent Connect"**

No edge-function change needed — the subject is sent from the dialog. Existing drafts where a user already typed a subject are preserved (the code only sets the default when subject is empty).

## 2. Fix Contacts search → "select name in list" behavior

In `src/pages/MyClients.tsx`, the typeahead dropdown under the Contacts search input (lines ~947–981) currently does this when you click a name:

```ts
onSelect={() => {
  setDrawerClient(client);
  setDrawerOpen(true);     // ← opens the contact card drawer
  setShowAutocomplete(false);
}}
```

You want clicking a name in the search dropdown to **select that contact in the list** instead of opening their contact card.

New behavior on select:
1. Set `searchTerm` to the contact's full name so the list filters down to just that person.
2. Add the contact's id to `selectedClients` (the checkbox-selected set) so the row is visibly selected and bulk actions are enabled.
3. Close the autocomplete dropdown.
4. Do **not** open the drawer.

```ts
onSelect={() => {
  setSearchTerm(`${client.first_name} ${client.last_name}`);
  setSelectedClients(new Set([client.id]));
  setShowAutocomplete(false);
}}
```

The contact card still opens via the normal row click — only the search-result behavior changes.

## Files touched
- `src/components/BulkEmailDialog.tsx` — one string change
- `src/pages/MyClients.tsx` — `onSelect` handler in the search autocomplete `CommandItem`
