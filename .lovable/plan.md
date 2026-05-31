# Consistent contact search across share & hot-sheet dialogs

## Goal
Make contact search in the share / hot-sheet dialogs behave identically to the fixed `/my-clients` search, so multi-token queries like `ethan goodrich` work everywhere (Ethan's last name is empty; "goodrich" lives only in his email domain).

## Files

**New**
- `src/lib/contactSearch.ts` — single shared helper.

**Edit (only these four)**
- `src/components/BulkShareListingsDialog.tsx`
- `src/components/share/PersonalHotSheetShareEmailDialog.tsx`
- `src/components/SaveToHotSheetDialog.tsx`
- `src/components/CreateHotSheetDialog.tsx`

## Helper API (`src/lib/contactSearch.ts`)

```ts
matchesContactQuery(client, rawQuery): boolean
searchClientContacts({ agentId, query, select?, limit? }): Promise<ContactRow[]>
```

Matcher rules — copied verbatim from `MyClients.tsx`:
- 1–2 char query → prefix / word-boundary match on first/last/display name, email local-part, email domain root.
- 3+ char query → split on whitespace; every token must match at least one of:
  first name, last name, display name, email, email local-part, email domain, email domain root, `client_type`, or (for digit tokens) phone digits.

DB strategy (keeps Supabase query short):
1. Take the **first token** only.
2. `from("clients").select(select).eq("agent_id", agentId).or("first_name.ilike.%tok%,last_name.ilike.%tok%,email.ilike.%tok%").order("first_name").limit(max(50, limit*5))`.
3. Run `matchesContactQuery` client-side on the candidates.
4. Return the first `limit` (default 10) results.

Empty / <2-char queries return `[]`.

## Dialog wiring

In each of the four dialogs, replace the inline `useEffect` that does the `.or(...)` query with a call to `searchClientContacts({ agentId: user.id, query: clientSearch, select: <existing select>, limit: <existing limit> })`. Preserve each dialog's existing post-processing (e.g. `SaveToHotSheetDialog` filters out already-selected clients). Keep the 300 ms debounce and the existing dropdown open/close logic.

## Out of scope (do not touch)
- `/my-clients` (already fixed)
- DB / RLS / importer / autocomplete UI / sort / unrelated contact flows
- Any other dialog that doesn't currently search the `clients` table by free text

## Verification (run in each of the four dialogs)
- `ethan` → returns Ethan
- `goodrich` → returns all 3 Goodrich contacts
- `ethan goodrich` → returns Ethan
- `j` → narrow prefix-only results
- empty / 1-char → no results
- No React key warnings or console errors