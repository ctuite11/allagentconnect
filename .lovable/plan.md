# Let signed-out listing visitors open that listing's agent profile

## What changes
A signed-out visitor who is viewing a public listing can click **View agent profile** and open **that listing agent's** profile without signing up. Everything else stays behind the existing sign-up wall.

| Situation (signed out, arrived via a listing) | Result |
|---|---|
| Profile of the listing's own agent, from that listing | Opens |
| Incentive buttons + Compare Agents on that profile | Work |
| "View Profile" on a compared agent | Sign-up wall (unchanged) |
| Any other agent profile, search, directory, etc. | Sign-up wall (unchanged) |

## How the exception is decided
- The listing used is the one already recorded for the visitor's guest visit (the listing they first opened), **not** a listing ID taken from the web address. A visitor can't unlock a profile by editing the web address.
- Before letting the profile through, the app looks up that listing in the public listing records and checks that its agent matches the profile being opened (by ID or AAC code). The listing must be publicly visible (never a Draft).
- While that check runs, the wall stays up (no flash of the profile). If the check fails or errors, the wall stays.
- The source listing continues to be passed to the profile, so incentive requests record it and the server derives the ZIP from it (already built).

## QA (signed out, no data left behind)
1. Open a public listing, click **View agent profile**: the listing agent's profile opens with no wall.
2. Listing context is preserved (listing attached; Compare uses the listing's ZIP).
3. Incentive buttons open the request form (only submit if approved again; any test request deleted).
4. Compare Agents loads.
5. "View Profile" on a compared agent shows the wall (if a compared agent exists; otherwise checked by opening another agent's profile directly).
6. Editing the web address to another agent's profile, or to the same agent with a different listing attached, still shows the wall.

## Not changing
Listing publishing, DCMLS eligibility, Hot Sheets, social, email, private settings, and the rest of the sign-up wall.

## Technical details
- `src/components/SharedListingGate.tsx`: for `/agent/:idOrCode` when in guest mode, resolve `allowedListingId` via `listings_public` (`agent_id`, status not draft) and compare with the route param (UUID or `aac_id` via `get_public_agent_profile`). Keep `blocked=true` while pending; cache the result per listing/profile pair.
- No database or server changes needed; `listings_public` is already readable signed out.
- Note: the wall is a browsing gate in the app. Visitors who didn't come from a listing can already open profiles directly, as before; this plan doesn't change that.
