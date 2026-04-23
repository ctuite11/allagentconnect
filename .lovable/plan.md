

## Buyer Search 1:1 Port — Acceptance Checklist Locked

### Status
Acceptance checklist accepted as the binding contract. No code, no exploration, no edits until local source is provided.

### Preconditions — currently UNMET
- [ ] Local `src/pages/BrowsePropertiesNew.tsx` full file (top-to-bottom, all imports)
- [ ] Full source for every non-standard import that file uses (price slider, custom card variants, helpers, hooks)
- [ ] Exact import paths preserved as written locally

Per Section A: if any required source is missing, task is blocked and must stop. **It is currently blocked.**

### Execution order (once source is pasted)

**Phase 1 — Import Inventory (read-only)**
- Parse every `import` line in pasted local file
- Produce inventory table classifying each as: `exists-identical` / `exists-different` / `missing`
- Surface every `missing` item explicitly
- If anything in `missing` was not pasted → stop and request before proceeding

**Phase 2 — Dependency Port**
- Create each `missing` file at the exact local import path
- Verbatim source — no merging, renaming, or re-homing

**Phase 3 — Main File Replacement**
- Overwrite `src/pages/BrowsePropertiesNew.tsx` with local source verbatim
- Zero restyling. Zero refactoring. Zero behavioral change.
- Allowed adaptations only:
  1. Supabase import normalized to `@/integrations/supabase/client` if local path differs
  2. `forceBuyer` prop/wrapper compatibility — only if strictly required to keep `BuyerSearch.tsx` route contract working (will flag and ask, not guess)

**Phase 4 — Route-Safety Guardrails (untouched)**
- `App.tsx`
- `src/pages/BuyerSearch.tsx`
- `BuyerLayout`
- `BuyerPortalHeader`
- Buyer chain stays: `/client/search` → `BuyerSearch` → `<BrowsePropertiesNew forceBuyer />`
- Buyer search does not collapse into shared public/DCMLS flow

**Phase 5 — Validation**
- TypeScript check
- Fix only errors caused by the port, at call sites, minimally
- Pre-existing unrelated errors flagged, not fixed

### Final delivery format (Section G)
1. Files created — with paths
2. Files replaced — with paths
3. Forced adaptations — exact lines + reason
4. Confirmation route-safety files untouched
5. Validation summary — pass/fail + residual unrelated issues

### Fail conditions enforced (auto-reject triggers)
- Reconstruction from screenshot/memory → rejected
- Unrequested route/layout refactor → rejected
- Out-of-scope edits without necessity → rejected
- Guessing a missing dependency → rejected (must stop and ask)
- Styling/UX improvements not in local source → rejected

### One-line execution rule (binding)
*Local source is the spec; port dependencies first, then replace `BrowsePropertiesNew.tsx` verbatim, with only mandatory integration adaptations.*

### Your next action
Paste in your next message:
1. Full contents of local `src/pages/BrowsePropertiesNew.tsx`
2. Full contents of every non-standard component/util/hook it imports (price slider especially)
3. The exact import paths used locally for those dependencies

Until that arrives, no files will be opened or edited.

