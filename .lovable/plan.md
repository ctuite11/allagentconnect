Update the forwardable "Why pay for a network..." email CTA to link to the public Request Access page (`/register`), matching the screenshot.

## Changes
1. **`supabase/functions/_shared/buildPersonalForwardEmailHtml.ts`** — Change CTA href to `https://allagentconnect.com/register` and button label to "Request Access".
2. **Redeploy** `send-personal-forward-invite` and re-send a test email to chris@allagentconnect.com to confirm the link lands on the Request Access form.

No other flows touched.