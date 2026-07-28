## Verify & Publish Meta Pixel

**Current state (verified in `index.html`):**
- `fbq('init', '1057808070926908')` ✅
- `<noscript>` image: `https://www.facebook.com/tr?id=1057808070926908&ev=PageView&noscript=1` ✅

Both already carry the correct Pixel ID from commit `af212f5d`. No code changes needed.

**Action:**
1. Confirm no other Pixel IDs remain anywhere in the repo (quick `rg` sweep).
2. Publish to production so the live site serves the corrected ID.
3. No signup/conversion events added — PageView only, as requested.

After publish, you can verify in Meta Events Manager → Test Events.