
I found the issue: the generated file changed the monogram itself. Your uploaded reference shows the correct DCMLS icon already. What you want is not a new logo mark — just that existing DCMLS icon lockup rebuilt to follow AAC sizing, font, and spacing rules.

Updated implementation plan:

1. Use the uploaded DCMLS icon as the source of truth
- Keep the exact blue DCMLS symbol from your reference
- Do not use the AAC house mark
- Do not use the old command-style AAC monogram
- Do not change the DCMLS icon geometry

2. Match AAC typography exactly
- Pull the wordmark spec from `src/components/brand/Logo.tsx`
- Inter, 22px, 600 weight, `-0.01em` letter-spacing
- Keep text as: `Direct Connect MLS`
- Single text color only:
  - dark on light/transparent
  - white on dark

3. Match AAC lockup proportions
- Rebuild the DCMLS lockup so it follows AAC’s visual rhythm only:
  - 48px lockup height
  - AAC-style icon-to-text scale relationship
  - AAC-style horizontal spacing/gap
  - vertical alignment tuned so the icon and cap height feel consistent

4. Regenerate corrected assets as a fresh revision
- `dcmls-lockup-light_v6.svg/png`
- `dcmls-lockup-dark_v6.svg/png`
- `dcmls-lockup-transparent_v6.svg/png`

5. QA before delivery
- Verify the monogram matches your uploaded reference, not AAC
- Verify font/style matches AAC wordmark rules
- Verify spacing feels like AAC without altering the DCMLS symbol
- Verify no unintended color treatment on `MLS`

Scope for this pass:
- Artifact correction only
- No repo branding swaps
- No additional logo cleanup until the corrected DCMLS lockup is visually approved
