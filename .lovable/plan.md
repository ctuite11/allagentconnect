# Temporarily hide all Developer access

## What visitors will see
- The Request Access page will show only the Agent path; the Developer card and its explanatory copy will be hidden.
- Direct visits to the Developer request form, Developer sign-in, or any private Developer workspace URL will return to the AAC homepage.
- Existing agent login and access-request behavior will remain unchanged.

## Implementation
- Add one reversible `DEVELOPER_ACCESS_UI_ENABLED` frontend feature flag, set to `false`, alongside the existing centralized flags.
- Use that single flag for the Request Access Developer card and every Developer access route:
  - `/developer-access`
  - `/developer-login`
  - `/developer`
  - `/developer/developments/new`
  - `/developer/developments/:developmentId` and its child pages
- Keep all Developer pages, workspace code, account memberships, projects, database records, functions, storage, and role resolution intact. Turning the flag back on restores access.
- Do not change agent-facing New Developments browsing or admin development management; this scope is Developer request, sign-in, and private portal access only.

## Safeguards and tests
- Add focused route/visibility tests proving the Developer card is absent and every direct Developer access URL is blocked while the flag is off.
- Confirm Agent Request Access and Agent Login still work.
- Confirm a developer role cannot enter the private portal through the ordinary login redirect while the flag is off.
- Run the relevant tests and type-check, then verify the hidden state on the live site after the normal GitHub `main` → Netlify deployment.

No backend, account, project, listing, email, Hot Sheet, publishing, or stored-data changes.
