The step 2 description renders literal `you&rsquo;ll` because the source string contains the HTML entity `&rsquo;` but the text is passed through `escapeHtml()`, which turns `&` into `&amp;`. Same bug potential in step 3 (`don&rsquo;t`).

## Fix
In `supabase/functions/_shared/buildCommsCenterGuideEmailHtml.ts`, replace `&rsquo;` inside the step `desc` strings with a real Unicode apostrophe `’` (or `'`). `escapeHtml` will leave them alone and email clients render correctly.

Then redeploy `send-comms-guide-email` so the updated shared module is bundled.

No frontend or template structure changes.