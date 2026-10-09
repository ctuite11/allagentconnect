# Finish the temporary DCMLS hide and confirm production

## Current state confirmed

The single `DCMLS_SETTINGS_UI_ENABLED` switch is already off and currently gates the requested surfaces in source:

- Add Listing and Edit Listing DCMLS sections and listing-level controls
- DCMLS publishing introductions, confirmation text, and badges in AAC
- DCMLS Requests sidebar entry and direct request routes
- Profile and Settings DCMLS preferences
- DCMLS save fields while hidden, preserving stored values instead of overwriting them

The changes are already present on GitHub `main`, the branch that deploys `allagentconnect.com`.

## Plan

1. Confirm the production deployment has finished from GitHub `main`.
2. Perform a signed-in, read-only live check on `allagentconnect.com` covering Settings, Profile, Add Listing, Edit Listing, the sidebar, and direct DCMLS Requests URLs.
3. Confirm no agent-facing DCMLS text or controls remain visible and direct request URLs return agents to the dashboard.
4. Make no database, saved-value, listing, email, Hot Sheet, publishing-logic, or DCMLS backend changes.
5. Report the production result and stop. If production does not yet contain the existing `main` version, wait for or diagnose only the normal GitHub-to-Netlify deployment rather than using Lovable Publish.
