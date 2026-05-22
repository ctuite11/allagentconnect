## Scope

Three targeted fixes against `src/components/CreateBuyerDialog.tsx` and the `agent_end_client_relationship` RPC. No new components, no redesign.

---

## 1. Hover color → AAC premium light gray

The contact picker dropdown (cmdk `CommandItem`) currently highlights the focused row in green (the selected/active item style inherited from the global Command component). Change just the hover/focused row inside this dialog to AAC premium light gray.

Approach: pass an explicit `className` to the `CommandItem` rendered inside `CreateBuyerDialog` so it overrides the default `data-[selected=true]` background with a neutral light-gray token (e.g. `bg-muted` / `bg-secondary` from the existing palette — token chosen to match the AAC light-gray surface already used elsewhere). Text color stays foreground.

Scope-limited to this dialog only — does not touch the shared `Command` component.

---

## 2. Audit dropdown search

User reports: typing in "Search by name or email…" doesn't filter, but the list is scrollable. Findings from the code:

- `CommandItem.value` is `` `${name} ${c.email}` ``, which includes `undefined` when name/email are missing — that string gets baked into the cmdk filter index and can break matching.
- `CommandEmpty` and `CommandGroup` exist, but cmdk's default filter is a fuzzy score that returns 0 for some clean substrings when `value` contains "undefined" tokens.
- No explicit `filter` prop on `<Command>`, so all filtering is delegated to cmdk defaults.

Fixes:

1. Sanitize the `value` string: build it from non-empty pieces only — `[first_name, last_name, email].filter(Boolean).join(" ").toLowerCase()`.
2. Add a custom `filter` prop on `<Command>` that does a simple case-insensitive `includes` match against `value`. This guarantees substring search works for partial first names, last names, and emails (the previous fuzzy behavior was the root cause of "search not working but I can scroll to the contact").
3. Keep the existing `CommandList` height/scroll behavior so users can still scroll the full list when the input is empty.

No data-fetch changes — the 500-row CRM contact load stays as-is.

---

## 3. Removing a buyer must clear "Buyer" status in My Contacts

Today `agent_end_client_relationship` intentionally leaves `public.clients` untouched, so the contact still shows `client_type = 'buyer'` in My Contacts after removal.

Migration: update `agent_end_client_relationship(p_client_id uuid)` to also do:

```sql
UPDATE public.clients
SET client_type = NULL
WHERE id = p_client_id
  AND agent_id = auth.uid()
  AND client_type = 'buyer';
```

This runs at the end of the function (after the relationship is ended, before `RETURN`). It only flips rows owned by the calling agent and only when they were tagged as `buyer`. The contact record itself is preserved — only the buyer classification is dropped, matching user expectation that "removed as a buyer" → no longer shows Buyer in My Contacts.

A one-time backfill is also included for any current contacts whose `client_type='buyer'` but who no longer have an active/pending `client_agent_relationships` row for their agent (e.g. Nataliia), so they immediately reflect the corrected state.

---

## Files

- `src/components/CreateBuyerDialog.tsx` — hover override + sanitized `value` + custom `filter` on `<Command>`.
- New migration `supabase/migrations/<ts>_clear_buyer_status_on_remove.sql` — updated RPC + backfill.

## Out of scope

- No changes to the shared `Command` / `CommandItem` UI primitives.
- No changes to BuyersList, RemoveBuyerClientDialog copy, or contacts page UI.
- No deletion of contact rows — only the `buyer` tag is cleared.
