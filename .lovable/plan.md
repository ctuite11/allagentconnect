# Simplify initial License Verified activation email

## Scope

- Update `supabase/functions/_shared/buildLicenseVerifiedEmailHtml.ts`.
- Update `supabase/functions/send-license-verified-preview/index.ts` so the preview accurately matches the production email (correct CTA label and founder footer).
- Render a preview only; do not send a real member email.
- Do not change token issuance, CTA URL generation, expiration logic, activation security, queue behavior, or sender/footer identity.

## What changes

In `buildLicenseVerifiedEmailHtml.ts`:

- Keep the dark header monogram and "All Agent Connect" lockup.
- The dark header should contain only:
  - AAC monogram
  - "All Agent Connect"
  - Headline: **Your account is ready**
- The white body should contain only:
  - **Hi [First Name],**
  - **Your real estate license has been verified. Activate your All Agent Connect account to get started.**
  - CTA: **Activate Account**
  - Existing `ctaNote` expiration line directly below the CTA
- Keep the existing Chris Tuite founder footer unchanged.
- Remove completely:
  - The large "Your license has been verified" headline.
  - "Your account is approved and ready to use."
  - The "Congratulations, [name]..." greeting paragraph.
  - The "You now have full access..." paragraph.
  - The entire "What's next" section and its three bullets.
  - The Communications Center highlight box.

In `send-license-verified-preview/index.ts`:

- Change `ctaLabel` from `"Activate My Account"` to `"Activate Account"`.
- Pass the same `FOOTER_AGENT` object used by `hydrateActivationEmail.ts` so the preview shows the Chris Tuite founder footer instead of the generic footer.

## How

In `buildLicenseVerifiedEmailHtml.ts`:

- Restructure the dark header `<td>` to show only the monogram/brand and the new headline.
- Replace the body `<td>` content with only the greeting/body paragraph and the CTA block (no bullets, no highlight box).
- Preserve all existing HTML wrapper, preheader, and footer rendering.
- Update the default `ctaLabel` fallback to "Activate Account".
- Leave `ctaNote`, `preheader`, `footerAgent`, and `agentName` handling untouched; callers pass the actual expiration note.

In `send-license-verified-preview/index.ts`:

- Change the `ctaLabel` passed to the builder from `"Activate My Account"` to `"Activate Account"`.
- Import or inline the same `FOOTER_AGENT` values from `hydrateActivationEmail.ts` and pass them as `footerAgent`.
- Keep recipient as the authenticated admin, CTA inert (`#`), no activation token issued, and no queue/email_jobs writes.

## Preview and verification

- Use the existing `send-license-verified-preview` Edge Function path to render the HTML preview for the authenticated admin.
- Verify the output shows: dark header with monogram, "All Agent Connect", and "Your account is ready"; white body with "Hi [First Name],", the body copy, "Activate Account" CTA, and expiration line; Chris Tuite founder footer.
- No real member email will be sent.

## Files expected to change

1. `supabase/functions/_shared/buildLicenseVerifiedEmailHtml.ts`
2. `supabase/functions/send-license-verified-preview/index.ts`

Do not change `supabase/functions/_shared/hydrateActivationEmail.ts`; its production License Verified path already uses `"Activate Account"` and the Chris Tuite footer correctly.
