Root cause: the forwardable invite email function still defaults its CTA to `/register`. The admin button that sent your email does not pass a CTA override, so the email used that old route.

Plan:

1. Update the forwardable invite email default CTA to:
   `/auth?mode=register&source=personal_forward`

2. Update the related agent-forward invite default CTA to the Auth signup page too, so both versions of this email stop using `/register`.

3. Keep the email button text and template unchanged; only the CTA destination changes.

4. Deploy the updated email functions so the live sender uses the corrected CTA.

5. Send you a fresh forwardable invite email and verify the queued email HTML contains the corrected Auth signup URL, not `/register` or `/request-access`.