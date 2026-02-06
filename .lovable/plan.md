

# Plan: Update OG Monogram to Emerald Green

## Overview
Replace the gray color (`#6B7280`) with AAC Success emerald green (`#059669`) in the OG image monogram and the "Connect" wordmark text.

---

## Current State
- **Monogram SVG**: `public/og/aac-monogram.svg` uses gray `#6B7280` for the interior path
- **OG Render HTML**: `public/og/og-render.html` uses gray `#6B7280` for the "Connect" text and descriptor
- **Brand Color**: AAC Success is defined as `#059669` (Emerald-600)

---

## Files to Update

### 1. `public/og/aac-monogram.svg`
Change the interior path fill from gray to emerald green:

```svg
<!-- Line 5: Change fill color -->
<path ... fill="#059669"/>  <!-- Was #6B7280 -->
```

### 2. `public/og/og-render.html`
Update the CSS for the "Connect" wordmark and descriptor to use emerald green:

| Element | Current Color | New Color |
|---------|--------------|-----------|
| `.wordmark .connect` | `#6B7280` | `#059669` |
| `.descriptor` | `rgba(107, 114, 128, 0.85)` | `rgba(5, 150, 105, 0.85)` |

---

## Technical Details

### Color Values
| Token | Value |
|-------|-------|
| AAC Success (Emerald-600) | `#059669` |
| AAC Success RGB | `5, 150, 105` |

### Updated CSS (og-render.html)
```css
.wordmark .connect {
  font-weight: 700;
  color: #059669;  /* AAC Success Emerald */
}

.descriptor {
  font-size: 32px;
  font-weight: 600;
  color: rgba(5, 150, 105, 0.85);  /* Emerald at 85% opacity */
  letter-spacing: 0.08em;
  margin-bottom: 12px;
}
```

---

## Post-Update Steps
After updating the SVG and HTML:
1. Regenerate the OG image: `node scripts/generate-og-image.cjs`
2. Update `index.html` and `netlify.toml` with the new dated filename
3. Verify via Facebook Sharing Debugger

---

## Summary
- Updates the monogram interior from gray to emerald green `#059669`
- Updates "Connect" wordmark from gray to emerald green
- Updates descriptor text to use emerald green at 85% opacity
- Maintains brand consistency with the AAC Success color standard

