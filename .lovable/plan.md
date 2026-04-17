
User wants the DCMLS lockup files to match the AAC logo's font and sizing conventions.

AAC wordmark spec (from `src/components/brand/Logo.tsx`):
- Font: `Inter, system-ui, sans-serif`
- Size: 22px in a 220×48 viewBox
- Weight: 600
- Letter-spacing: -0.01em
- Colors: "All Agent " in #0E56F5, "Connect" in #16A34A
- Monogram (when paired): from `aac-logo-master.svg`, sized via `h-{size}` class, width auto

The DCMLS lockups I generated likely used a different font (probably Manrope/DM Sans or default sans) and arbitrary monogram-to-wordmark proportions. Need to regenerate to match AAC exactly.

## Plan

Regenerate the DCMLS lockup SVG/PNG set to match AAC's typographic system:

1. **Font**: Inter, weight 600, letter-spacing -0.01em (same as AAC `Logo.tsx`)
2. **Sizing/proportions**: Match AAC's monogram-to-wordmark ratio — viewBox height 48 with monogram filling the height and wordmark at 22px font-size, 9px gap (mirrors `AllAgentConnectLogo` Figma export spacing rhythm)
3. **Colors** (per locked rule from prior turn):
   - Monogram: full `#0E56F5` (AAC blue)
   - Wordmark "Direct Connect MLS": single color — `#0F172A` on light variant, `#FFFFFF` on dark variant, NO blue on "MLS"
4. **Variants to regenerate** (overwrite existing files in `/mnt/documents/dcmls-logos/`):
   - `dcmls-lockup-light.svg` + `.png` (dark text on white)
   - `dcmls-lockup-dark.svg` + `.png` (white text on dark)
   - `dcmls-lockup-transparent.svg` + `.png` (dark text, no bg)
   - Monogram-only files unchanged (already correct)
5. **PNG export**: render at 1600px wide via librsvg, embed Inter from Google Fonts in SVG `<defs>` so rasterization picks it up
6. **QA**: convert each PNG to a thumbnail and inspect for font rendering + proportions before delivering

No code changes to the project repo — artifact regeneration only, output to `/mnt/documents/dcmls-logos/`.
