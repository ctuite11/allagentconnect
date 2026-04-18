
Goal: replace the failed signature set with a Gmail-specific artifact set where AAC and DCMLS are built from one shared master template and differ only by monogram color and wordmark text.

What I’ll use as the fixed source of truth
- Monogram geometry: `src/components/ui/AACMonogram.tsx`
- Typography spec: `src/components/brand/Logo.tsx` (`Inter`, `22px`, `600`, `-0.01em`)
- No legacy asset inheritance, no outlined-text fallback, no font substitution in the master SVGs

Build approach
1. Create one shared lockup template
- One master geometry for both brands with identical:
  - canvas height
  - monogram render box
  - text size/weight/tracking
  - icon-to-text gap
  - baseline alignment
  - total lockup height
- Swap only:
  - monogram color (`#16A34A` AAC, `#0E56F5` DCMLS)
  - wordmark text (`All Agent Connect`, `Direct Connect MLS`)

2. Regenerate Gmail-ready outputs only
- Transparent PNGs optimized for signature use:
  - `60px` tall standard
  - `120px` tall retina
- Tight crop with equal top/bottom padding
- Crisp text rendering
- Matching master SVGs using the same vertical metrics and lockup logic

3. QA against the failure criteria
- Create one stacked comparison image exactly like the user’s screenshot layout
- Verify AAC and DCMLS are visually matched in:
  - text size
  - weight
  - tracking
  - icon/text gap
  - overall height
  - baseline alignment
- If any one of those differs visually, regenerate before delivery

4. Package deliverables
- New folder with only the corrected Gmail-ready set
- `brand-lockups-signature.zip`
- Include `README.txt` with exact usage guidance for Gmail:
  - standard `60px` version
  - retina `120px` version
  - transparent-background recommendation

Scope
- Artifact-only
- No code changes unless inspection reveals the export source itself still depends on a legacy asset path; if so, I’ll isolate the generator from repo fallbacks rather than altering app branding

Expected output set
- AAC transparent PNG `60px`
- AAC transparent PNG `120px`
- DCMLS transparent PNG `60px`
- DCMLS transparent PNG `120px`
- Matching AAC/DCMLS transparent SVG masters
- One stacked QA sample proving parity
- ZIP package with README
