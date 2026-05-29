In `supabase/functions/send-bulk-email/index.ts`:

1. Delete the Founding Partner Benefits `<tr>` block (lines 304–314): the eyebrow heading, the emerald divider, and the 5-row checkmark table.
2. Change the CTA button label on line 316 from `Founders &rarr;` to `Founding Partners &rarr;`.

Then redeploy the `send-bulk-email` edge function so the next send uses the updated template.

No other content (header, headline, quote, screenshots, feature sections, closing copy, signature, footer) changes.