# Coordinated Privacy Lockdown and Google Cleanup (v2)

Approval scope: prepare and test the fixes in an isolated environment only. Production, the live database and live storage won't change until you give final approval.

## 0. Isolated testing (answer to your point 1)
- This project's preview and the live site share one database. The earlier "private test copy" only isolated website code, not the database.
- So all database, permission and storage testing will happen in a **draft with its own separate database**:
  - It starts with the same structure as production but none of the real data.
  - I'll fill it with fake test records: verified, invited, unverified, suspended and hidden agents; Active, Coming Soon, Off Market and Draft listings; a buyer Hot Sheet with a valid link; a share link; and photos.
  - It has no live email sending, so nothing can reach real people.
- If the draft can't get its own database, I'll stop and tell you before running any permission change. I won't fall back to the live database.

## What was confirmed so far (read-only)
- Google has indexed 201 agent profiles and 24 property pages. This is from your Search Console report.
- Signed-out visitors can read:
  - listings through `listings_public`, `dcmls_listings_public` and `seller_matches_public`
  - any agent's profile, including hidden and invited agents, through `get_public_agent_profile`
  - listing and agent details through `get_public_listing` and `get_public_listing_agent`
  - lists of agents through `get_verified_agent_ids` and `get_newest_verified_agents`
  - online status through `get_agent_presence`
- About 100 elevated functions are runnable by signed-out visitors.
- These file folders are open to anyone: listing photos, floor plans, agent-match photos and email attachments. Headshots, logos and brand files are open too.
- The property-preview step writes the address, price, description and photo into /property/ pages on the server, before the page loads.
- The site sends "index everything" on every page.
- directconnectmls.com and allagentconnect.lovable.app also show agent pages to signed-out visitors (they return 200 OK).

## 1. Backend security
- **Full function review:** I'll check every elevated function that signed-out visitors or members can run. Each one gets a recorded decision in the report:
  - keep for signed-out visitors (sign-up, activation, valid-link checks, homepage counts)
  - members only
  - verified members only
  - service only
- **Access depends on membership, not just signing in.** Network data (listings, agent profiles, buyer needs, Communications) requires a verified agent who isn't suspended or restricted. This uses the existing `is_verified_agent` checks. Being signed in as invited, unverified, suspended, rejected or a buyer isn't enough.
- **Data views:** remove signed-out access from `listings_public`, `dcmls_listings_public` and `seller_matches_public`, and restrict them to verified agents. I'll also check rights they inherit through `public` and through view ownership.
- **Access rules:** list every table that signed-out visitors can read, and every rule that allows "any signed-in user". I'll tighten the network-data ones to verified agents.
- **Profiles:** only verified, non-hidden agents are returned to other verified agents. Hidden, invited and unverified agents are never returned.
- **Buyer links:** `get_hot_sheet_by_token`, `resolve_share_token` and `accept_client_hot_sheet_invite` stay available. I'll verify each returns only the listings explicitly on that sheet or link.

## 2. Photos and attachments — protected in the same release
Solution: make the listing photos, floor plans, agent-match photos and email attachments folders private, and serve files through one secure image gateway.
- **Members:** the app asks the gateway for short-lived signed links. The gateway checks the user is a verified agent.
- **Buyer links:** the gateway checks the Hot Sheet or share code and only signs photos of listings on that sheet or link.
- **Emails:** Hot Sheet and share emails currently embed permanent public photo addresses. Once the folders are private, those images would break, in both already-sent and new emails.
  - Option A (recommended): emails point at an image address on the gateway that includes the recipient's link code, so images keep showing for the right recipient only. This changes the email photo address the shared builder produces, which needs your explicit approval because email templates are frozen.
  - Option B: emails show photos only after the buyer clicks through to the signed-in or link page.
  - Either way, emails sent before the change lose their images. Their links still work.
- Headshots, logos and brand files stay public, as the email masthead and footer need them. Headshots of hidden agents will be checked.
- If testing shows the photo change can't safely go out with part 1, I'll report the remaining exposure. The privacy issue won't be called resolved until photos are private.

## 3. Website pages
- Signed-out visitors to /agent/:id, /property/:id, /team/*, /our-agents and listing search are sent to Login with a return path.
- Valid buyer links open the shared-listing page, limited to authorized listings.

## 4. Property previews
- Turn off the server-side property preview. Shared links show the generic AAC card.
- The function file stays in place so this can be rolled back.

## 5. Google — in real server responses
- These are set in the hosting settings, so the server sends them on every response, including redirects and the bare page before JavaScript loads:
  - remove the site-wide "index everything" header
  - add "noindex, nofollow" to all private routes
  - the 10 public marketing pages keep "index"
- Because the backend and pages are locked, no listing or agent data appears in page source.
- **Tested on all three domains:**
  - allagentconnect.com and directconnectmls.com get the same hosting settings, so the same headers.
  - The lovable.app copy gets its headers from the page itself plus the locked backend, so data is protected there too. I'll report whether the noindex header itself arrives there.
- After release (you do this in Search Console): submit Removals prefix requests for `/agent/` and `/property/` on each verified domain.

## 6. Evidence of actual unauthorized retrieval
- Backend request logs keep only a short recent window. I'll search them for signed-out requests to the listing views, profile functions and photo files, broken down by source, crawler and volume.
- Website hosting logs (Netlify, Cloudflare) aren't visible to me. I'll list exactly which reports you or Nenad can pull.
- The report will separate three things: confirmed retrievals, crawler retrievals (Google, Facebook), and what can't be determined because the logs aren't kept long enough.

## 7. Test matrix (in the isolated draft)
Accounts tested: signed-out, Googlebot, Facebook crawler, verified agent, delegate, invited, unverified, suspended/restricted, hidden agent, buyer with a valid link, buyer with a link for a different sheet, buyer with an invalid link.

| Check | Expected |
|---|---|
| Each locked view and function, called directly | Only verified agents get data |
| Agent profiles (hidden, invited, unverified) | Never returned |
| Property pages for each status | Agents: full. Valid link: only that listing. Others: nothing. |
| Photo and file links | Signed link required; buyer link limited to its listings |
| Hot Sheets, invitations, share links | Work within their permissions |
| Communications, Success Hub, search, My Listings | Unchanged for verified agents |
| Homepage counts | Unchanged, numbers only |
| Page source and preview tags on /property/ | No listing data |
| Server headers on private and marketing pages | noindex on private pages, index on the 10 marketing pages |

No emails will be sent. Email output will be checked by rendering it, not by sending.

## 8. Rollback
- Database: a paired rollback migration that restores the previous grants and function bodies exactly. It's prepared and tested in the draft.
- Storage: switch the folders back to public.
- Hosting and app: revert the commit. The preview function file is kept, so this is instant.
- A rollback runbook with the exact order of steps goes in the report.

## 9. Proposed release sequence (after your final approval)
1. Hosting noindex headers and the preview function turned off. No impact on members.
2. Backend lockdown, app page guards and the image gateway, released together.
3. Folders made private (with your approved email image option).
4. Re-run the test matrix against production. Then you submit the Search Console removals.

## 10. For Weborik / Nenad
A handover document (`docs/audits/2026-11-privacy-lockdown.md`) listing:
- every migration, with its rollback
- the storage folder settings and access rules
- the image gateway function and its secrets
- the `netlify.toml` changes
- the app route changes
- the test matrix, to re-run before switching to the new environment

## Technical details
- Use `drafts--create` for the isolated database and confirm it really is isolated before running any migration.
- Review `pg_proc` where `prosecdef` and `has_function_privilege('anon'|'authenticated')`. Check `information_schema.role_table_grants` and view owners. Check `pg_policies` for rules that only test `auth.role()='authenticated'` or `true`.
- Image gateway: an edge function that checks the user is a verified agent (from the JWT) or that the link code matches a valid Hot Sheet or share listing, then returns a signed storage link (302 redirect). App photo helper: `getListingPhotoUrl` (13 places) switches to the gateway.
- Netlify `[[headers]]` per private path with `X-Robots-Tag: noindex, nofollow`. Remove the global `X-Robots-Tag = "all"` and the `/property/*` edge function entry.
- SQL grant tests go under `supabase/tests/`, in the same style as the existing ones.
