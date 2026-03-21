

# Standardize Primary CTA Buttons to AAC Blue + White Text

## Summary
Align `--primary` token to AAC blue, then remove hardcoded blue hex values from CTA surfaces. 7 files total.

## Steps

### 1. Align `--primary` to AAC blue
**File:** `src/index.css`
- Line 77: `--primary: 215 95% 55%` → `--primary: 221 92% 51%`
- Line 160: `--primary: 215 100% 55%` → `--primary: 221 92% 51%`

### 2. Remove hardcoded `#0E56F5` from CTA buttons
- **`src/pages/AgentMatch.tsx`** — Remove `bg-[#0E56F5] hover:bg-[#0D4AD9]` from 3 CTA buttons (use default Button variant). Normalize progress dots → `bg-primary`.
- **`src/pages/SellerListingDetail.tsx`** — Remove `bg-[#0E56F5] hover:bg-[#0D4AD9]` from Sign In button.
- **`src/components/agent-match/AgentMatchAuthDialog.tsx`** — Remove `bg-[#0E56F5] hover:bg-[#0D4AD9]` from submit button.

### 3. Replace `#2537ff` drift on homepage
- **`src/components/home-v2/FinalCTA.tsx`** — Replace `#2537ff` button/border → `bg-aac` with `border-[hsl(var(--aac)/.25)]`.
- **`src/components/home-v2/FooterV2.tsx`** — Replace `#2537ff` Subscribe button → `bg-aac hover:bg-aac-hover`.
- **`src/components/home-v2/HeroSection.tsx`** — Replace `#2537ff` glow accent → AAC blue. Preserve blur/opacity effect.

### 4. Not touched
- Secondary, outline, ghost, destructive variants
- `bg-blue-*` badges, radio-group indicators, LandingPage badge dot, AgentMatchResultsPanel decorative elements
- Filters, tabs, chips, pills, button sizing/spacing/radius
- Files in `design/` directory

## Files Modified
| File | Change |
|------|--------|
| `src/index.css` | `--primary` → `221 92% 51%` (light + dark) |
| `src/pages/AgentMatch.tsx` | Remove hardcoded CTA blue + normalize dots |
| `src/pages/SellerListingDetail.tsx` | Remove hardcoded CTA blue |
| `src/components/agent-match/AgentMatchAuthDialog.tsx` | Remove hardcoded CTA blue |
| `src/components/home-v2/FinalCTA.tsx` | `#2537ff` → AAC blue |
| `src/components/home-v2/FooterV2.tsx` | `#2537ff` → AAC blue |
| `src/components/home-v2/HeroSection.tsx` | `#2537ff` glow → AAC blue |

