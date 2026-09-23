# Simplify initial License Verified activation email

## Scope

- Update `supabase/functions/_shared/buildLicenseVerifiedEmailHtml.ts`.
- The preview renderer (`supabase/functions/send-license-verified-preview/index.ts`) imports this shared builder, so it will automatically render the new template.
- Render a preview only; do not send a real member email.
- Do not change token issuance, CTA URL generation, expiration logic, activation security, queue behavior, or sender/footer identity.

## What changes

In `buildLicenseVerifiedEmailHtml.ts`:

- Keep the dark header monogram and "All Agent Connect" lockup.
- Replace the header headline/subhead with a single new content block:
  - Headline: **Your account is ready**
  - Body: **Hi [First Name], Your real estate license has been verified. Activate your All Agent Connect account to get started.**
- CTA label: **Activate Account**
- Keep the existing `ctaNote` expiration line directly below the CTA.
- Keep the existing Chris Tuite founder footer unchanged.
- Remove completely:
  - The large "Your license has been verified" headline.
  - "Your account is approved and ready to use."
  - The "Congratulations, [name]..." greeting paragraph.
  - The "You now have full access..." paragraph.
  - The entire "What's next" section and its three bullets.
  - The Communications Center highlight box.

## How

- Restructure the dark header `<td>` to contain the new headline and body copy instead of the old headline/subhead.
- Replace the body `<td>` content with only the greeting/body paragraph and the CTA block (no bullets, no highlight box).
- Preserve all existing HTML wrapper, preheader, and footer rendering.
- Update the default `ctaLabel` fallback to "Activate Account".
- Leave `ctaNote`, `preheader`, `footerAgent`, and `agentName` handling untouched; callers pass the actual expiration note.

## Preview and verification

- Use the existing `send-license-verified-preview` Edge Function path to render the HTML preview.
- Verify the output contains only the approved headline, body, CTA, expiration line, and founder footer.
- No real email will be sent.

## Files expected to change

1. `supabase/functions/_shared/buildLicenseVerifiedEmailHtml.ts`
2. No source changes needed in `send-license-verified-preview/index.ts` (it already calls the shared builder).
