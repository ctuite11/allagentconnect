Change the default Agent Network page size from 24 to 48.

## Change
- Update the default `pageSize` state in `src/pages/OurAgents.tsx` (and any mirrored initial value used for `/our-members`) from `24` to `48`.
- Keep the "Show 24 / 48 / 96 / all" selector options unchanged in `AgentDirectoryFilters.tsx` so users can still switch.
- Subsequent pages continue to load 48 per page (no separate "next page size" needed — the selector controls it).

## Scope
Frontend-only. No backend, RLS, or query changes.