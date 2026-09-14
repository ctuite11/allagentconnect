# Verify Copy setup link (30-day, silent)

The change is already built and deployed. This is a live verification pass only — no code changes, no publishing.

## What gets checked

1. Pick one verified member who has **not** activated, and one who **has**.
2. Record the email queue count before starting.
3. Call the Copy setup link action as an admin for each of the two members.
4. Confirm:
   - unactivated member gets a link of the form `/activate#t=...`
   - activated member gets a link of the form `/signin-link#t=...`
   - both expire roughly 30 days out
   - the email queue count is unchanged — nothing sent or queued by either action
   - only the hashed token is stored; no plaintext link is saved anywhere
5. Confirm the Email setup link action and the License Verified email are untouched (code unchanged, no new queue rows created during the test).
6. Confirm the drawer wording reads "AAC activation/setup link (30 days, single-use)" with no "~1 hr" or recovery wording anywhere.
7. Run the type check and production build.

## Side effects

Each check issues one real single-use token for that member and revokes any earlier live token for them. No email is sent. If you'd rather I avoid touching a real member's live token, say so and I'll limit the test to a single account of your choosing.

## Out of scope

No code changes, no migrations, no deployments, no frontend publish.
