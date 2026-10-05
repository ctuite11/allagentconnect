# Move first-publish social choices onto Add Listing

## Goal
Keep the final listing review focused on the listing itself. Move first-publish social choices to a dedicated **Share this listing on social media** section near the bottom of Add Listing, immediately above **Save Draft / Preview / Publish**. Leave the existing DCMLS section where it is.

## Add Listing social section
- Show the section only to users already allowed by the existing development/test social gate. It remains hidden from ordinary agents.
- Include the four currently supported publishing networks: Facebook, Instagram, LinkedIn, and Threads.
- Each network has one action button:
  - Not connected: **Connect**
  - Connected but not selected: **Share**
  - Connected and selected: **✓ Share** in AAC blue
- The button itself is the selector. Clicking **✓ Share** only deselects that network; it never disconnects an account.
- Keep the existing AAC explainer before connection authorization.
- **Authorization safety:** Before opening a social Connect flow, save the complete current listing state through the existing safe Draft-save path. Do not leave the page unless that save succeeds and a valid Draft/listing ID is confirmed.
- After authorization, return to the same Draft, refresh connection status, and show **Share**. Do not automatically select the newly connected network.
- Show: **Selected networks will publish when this listing is published.**
- Keep disconnecting and account management only in **Settings → Social Publishing**.

## Save selections with the listing
- Store first-publish selections in the existing per-listing social defaults record, using the existing gated server function rather than granting browser write access.
- For a new listing, first establish a Draft ID using the existing safe draft-save path; do not open authorization or save a selection unless a valid listing ID is confirmed.
- Load saved selections whenever an existing Draft is reopened.
- Save selection changes without publishing the listing. A failed social-selection save must not change the Draft or block ordinary listing work.
- Preserve selected choices across the authorization return flow and ordinary Draft reopening.
- The saved choices are the listing's persistent defaults and preselect future eligible **Share this update?** prompts.

## Publish behavior
- Remove all social controls, connection checks, loading states, and social error states from **Ready to publish?**
- The confirmation remains the final listing-only review: address, property type, beds, baths, square feet, price, status, and DCMLS choice.
- Clicking **Yes, Publish Listing** keeps the existing listing validation, photo requirement, listing save, Hot Sheet/email behavior, status rules, and DCMLS behavior unchanged.
- Only after the listing successfully publishes, read the saved selections and post to the selected networks that are still connected.
- Social failure must never roll back or delay the successful listing publish.
- Report a post-publish social failure separately and visibly so the listing never appears unpublished.
- Publishing with no selected networks performs no social action.

## Later listing updates
- Keep the existing lightweight **Share this update?** prompt for eligible status or price changes.
- Continue preselecting that prompt from the listing's saved defaults.
- A one-off update choice does not overwrite the listing's saved first-publish defaults.

## Safety and launch controls
- Keep the server-side launch/test gate unchanged and enabled. Do not set `SOCIAL_LAUNCH_OPEN` or add test users.
- Social publishing remains development/test only and hidden from ordinary agents.
- Keep Profile social links live and separate; they remain public profile links, not publishing authorization.
- Do not change social tables, Bundle infrastructure, connection behavior, listing rules, email templates, Hot Sheet behavior, or DCMLS rules.

## QA
Use an allowed test account, a disposable Draft, and a stubbed Bundle response only.
- Confirm the section appears above the bottom **Save Draft / Preview / Publish** row and DCMLS remains in its current location.
- Confirm Connect → return shows **Share**, not **✓ Share**.
- Confirm Share ↔ ✓ Share persists after reopening the Draft.
- Open **Ready to publish?** and confirm it contains listing details plus DCMLS, with no social section or social loading state.
- Click **Go Back / Edit**, then delete the disposable Draft while it is still a Draft.
- Do not click **Yes, Publish Listing**; do not create a real connection, disconnect an account, publish a listing, send an email, create a Hot Sheet event, or send a social post.

## Technical
- Reuse `SocialPlatformChoices`, `ConnectSocialExplainerDialog`, `fetchSocialConnected`, `fetchListingSocialDefaults`, `saveListingSocialDefaults`, and `openSocialConnectPortal`.
- Refactor the authorization resume state so it returns to the Add Listing section rather than reopening the confirmation dialog, while preserving the safe `from` value.
- Separate test-access visibility from the global hold flag: render social controls only after the gated account-status request confirms access; a refusal or unavailable status renders no section for ordinary agents.
- Keep `SocialPostPrompt` for later eligible edits and retain the existing server-side authorization checks before every defaults write and post.
