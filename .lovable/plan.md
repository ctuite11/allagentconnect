
Two-part task:

**Part 1 — Regenerate DCMLS lockups correctly**
Output to `/mnt/documents/dcmls-logos/` as `_v2` files:
- Wordmark: Inter, 600, 22px, -0.01em (matches `src/components/brand/Logo.tsx`)
- Monogram: current AAC blue mark from `src/assets/aac-logo-master.svg` (NOT the old command-icon from `AACMonogram.tsx`)
- 48px lockup height, 9px gap
- Color rule: monogram all `#0E56F5`, "Direct Connect MLS" single color (dark on light, white on dark), no blue on "MLS"
- Files: `dcmls-lockup-light_v2.svg/png`, `dcmls-lockup-dark_v2.svg/png`, `dcmls-lockup-transparent_v2.svg/png`
- QA each PNG before delivery

**Part 2 — Remove old logo files from the codebase**

Old/legacy logo files to delete:
- `src/components/ui/AACLogo.tsx` (uses Manrope + old monogram)
- `src/components/ui/AACMonogram.tsx` (old command-style icon)
- `src/components/ui/src/components/ui/AACLogo.tsx` (empty/orphan duplicate path)
- `src/design-assets/figma-logo/AACLogoFigmaExport.tsx` (Figma reference, also old icon)
- `public/aac-monogram-green.svg` (old green monogram asset)

Before deleting, search the codebase for any imports of these files. Known consumer:
- `src/components/dcmls/DcmlsConsumerHeader.tsx` imports `@/components/ui/AACMonogram`

Plan:
1. Search for all references to each file (`AACMonogram`, `AACLogo` from `ui/`, `AACLogoFigmaExport`, `aac-monogram-green.svg`)
2. Replace each consumer with the canonical `Logo` from `@/components/brand/Logo` (icon variant for monogram-only usages like `DcmlsConsumerHeader`)
3. Delete the legacy files
4. Keep `src/components/brand/Logo.tsx` and `src/assets/aac-logo-master.svg` as the only source of truth

Canonical sources kept:
- `src/components/brand/Logo.tsx`
- `src/assets/aac-logo-master.svg`
- `mem://style/brand/monogram-variants-and-assets-v2-locked` (memory unchanged)

Execution order in default mode: search references → swap imports → delete legacy files → regenerate DCMLS `_v2` artifacts → QA → deliver.
