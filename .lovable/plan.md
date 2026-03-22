

# Dark Footer for AAC Email Template

## Change
Replace the current light gray footer (inside the white card) with a separate dark navy footer section that mirrors the header, creating a balanced dark-header / white-body / dark-footer sandwich.

## Single file change

**File:** `supabase/functions/_shared/aacEmailTemplate.ts`

### Current footer (lines 91-100)
The footer sits inside the white card body with a light border-top and gray text.

### New footer
Move the footer out of the white card into its own table row below the white content card:
- Background: `#111317` (matches header)
- Bottom corners rounded: `0 0 12px 12px`
- The white content card gets `border-radius: 0` on bottom (no longer the last visual block)
- Compact padding: ~20px vertical, 40px horizontal
- Centered white text at reduced opacity (`color: rgba(255,255,255,0.6)`)
- Two lines only: "All Agent Connect" and "hello@allagentconnect.com"
- Keep the "Remove my account" link but style it in muted white
- No logo, no CTA, no social icons

### Structure after change
```text
┌─ Dark header (#111317) ─── 12px 12px 0 0 ─┐
│  AAC green monogram                         │
│  "All Agent Connect" white                  │
│  green divider                              │
├─ White body ─────────────── 0 0 0 0 ───────┤
│  headline / body / CTA / fallback           │
├─ Dark footer (#111317) ─── 0 0 12px 12px ──┤
│  "All Agent Connect"  (muted white)         │
│  hello@allagentconnect.com                  │
│  Remove my account                          │
└─────────────────────────────────────────────┘
```

### What does NOT change
- Header block, monogram, wordmark, green divider
- `buildAacEmail()` signature
- Body content structure, CTA logic, preheader, fallback URL
- No consuming edge functions affected

