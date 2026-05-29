Adjust spacing in the Founding Partner email template (`supabase/functions/send-bulk-email/index.ts`) so the header, headline, quote, and hero image have a clearer visual rhythm.

## Changes

In the email template around lines 288–302:

1. **Header → Headline** (currently `padding:32px 0 16px` on the headline cell)
   - Increase top padding to ~56px so the headline gets ~56px of breathing room from the dark header strip.
   - New: `padding:56px 0 0`

2. **Headline → Quote** (currently `margin:0 0 14px` on the h1)
   - Bump to ~28px so the quote sits a touch lower but still feels connected.
   - New: `margin:0 0 28px`

3. **Quote → Hero image** (currently `padding:8px 0 0` on the image cell — too tight)
   - Increase to ~36px so the image no longer crowds the quote.
   - New: `padding:36px 0 0`

No other content, copy, colors, or structure changes. Only the three spacing values above.

## After

```
Header (dark strip)
  ↓ ~56px
Headline ("Why pay to join...")
  ↓ ~28px
Quote (green-bar block, Chris Tuite)
  ↓ ~36px
Hero image
```

Then redeploy `send-bulk-email` so the next preview reflects the new spacing.