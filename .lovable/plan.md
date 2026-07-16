
Hide the "N Agents found" count on the Network / Our Agents page (`/our-members`, `src/pages/OurAgents.tsx`).

## Change

In `src/components/agent-directory/AgentDirectoryFilters.tsx`, remove the `<p>` that renders `{resultCount} agents found …`. Replace it with an empty spacer `<div />` so the flex layout keeps the sort/page-size controls right-aligned. If a `searchQuery` is present, still show a small "Results for "…"" label (no number) so users know the search is applied — otherwise render nothing on the left.

Keep `resultCount` in the props (still used by the parent for pagination math) — just don't display it.

## Also

The pagination footer in `OurAgents.tsx` (line ~560) currently renders `Page X of Y · N total`. Drop the `· {totalCount.toLocaleString()} total` suffix so the count isn't leaked there either. Leave `Page X of Y` intact.

## Out of scope

- No changes to `PublicOurAgents.tsx` (doesn't render this count).
- No data-fetching changes.
- No layout/design changes beyond removing the count text.

## Files

- `src/components/agent-directory/AgentDirectoryFilters.tsx`
- `src/pages/OurAgents.tsx`
