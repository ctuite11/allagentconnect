

# Remove Opacity from Section Labels

Single file change in `src/components/home-v2/EcosystemSection.tsx`.

Remove `opacity: 0.85` from the inline styles of both section labels ("Data Inputs" and "Results"), keeping their colors at full strength (`#0E56F5` and `#22C55E`).

**Lines affected:**
- Line 248: Remove `opacity: 0.85` from DATA INPUTS label style
- Line 272: Remove `opacity: 0.85` from RESULTS label style

