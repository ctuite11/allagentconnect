## Change

In `src/lib/buildListingsQuery.ts` (line ~67), remove the implicit fallback that adds `["active", "coming_soon"]` when the caller passes an empty `statuses` array.

**Current:**
```ts
statuses: rawCriteria.statuses?.length ? rawCriteria.statuses : ["active", "coming_soon"]
```

**New:** honor the caller's `statuses` array as-is. When it's empty, apply a sentinel filter (`query.in("status", ["__none__"])`) so the query returns 0 rows.

## Why

The screenshot shows the default pill set (8 statuses checked → 5 results, correct). If the agent unchecks every status pill, they currently still see 5 results because the library silently re-adds `active` + `coming_soon`. Expected: **0 statuses selected → 0 results**.

## Scope guardrails

- Only touch `src/lib/buildListingsQuery.ts`.
- Do not change the search UI, the default pill set shown in the screenshot, or any other caller.
- No DB changes. DCMLS, hot sheets, and admin queries are untouched.

## Verification

- Uncheck all Status pills → `0 results`.
- Default pill set (8 checked) → still `5 results` (2 off_market + 3 coming_soon).
- Only "Off Market" checked → `2 results`.