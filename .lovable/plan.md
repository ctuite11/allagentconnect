

# Make AAC Monogram Green in Email Header

## Change
The hosted monogram SVG (`aac-monogram-white.svg`) is white. It needs to be AAC green (`#50c878`) on the dark navy header instead.

## Approach
1. **Upload a new green monogram SVG** to the `brand-assets` storage bucket — same command-style shape but with `fill="#50c878"` instead of white
2. **Update `aacEmailTemplate.ts` line 70** to reference the new green asset (e.g. `aac-monogram-green.svg`)

Only file changed: `supabase/functions/_shared/aacEmailTemplate.ts` (one URL swap). All consuming edge functions inherit automatically.

