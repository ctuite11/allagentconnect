# Simplify the activation email and account page

## Scope

- Update the dedicated verified-agent activation reminder email only; keep its secure activation URL, expiration line, and founder footer unchanged.
- Simplify only the current `/activate` setup screen. Leave the legacy account-setup page and all activation behavior untouched.
- Do not send email, deploy backend functions, or publish the frontend while preparing the revised preview.

## Email revision

- Headline: **Your account is ready**
- Greeting: **Hi [First Name],**
- Body: **Your real estate license has been verified. Activate your All Agent Connect account to get started.**
- CTA: **Activate Account**
- Keep the existing expiration line immediately below the button.
- Remove all other explanatory copy so the existing founder footer follows immediately.

## `/activate` page revision

- Keep the AAC header, monogram, License verified badge, form, password requirements, Terms/Privacy, and every existing loading/error/resend/security state.
- Replace the marketing introduction with:
  - **Activate Your Account**
  - **Complete the information below to activate your All Agent Connect account.**
- Remove the four benefit rows and use a compact single-column layout so the form begins near the top on mobile.
- Change the final button label to **Activate Account**.

## Validation

- Check the email HTML output contains only the approved headline/body/CTA before the unchanged expiration line and founder footer.
- Check `/activate` at mobile and desktop sizes for compact spacing and no overflow.
- Confirm typecheck/build status and verify no activation logic or endpoint files changed.
