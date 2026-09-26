# Listing to Social Media Publishing (bundle.social) — V1

## Where it gets built
Code that lands on GitHub main goes live on allagentconnect.com automatically. To honor "do not deploy to production yet", this work is built in a **separate Lovable draft** (its own isolated backend and preview). Nothing merges to main until you approve the finished draft.

## What agents will see
1. **Settings → Social Media** (verified/activated agents only): Facebook, Instagram, LinkedIn, Threads, each shown as Connected / Not Connected, with a Connect button that opens bundle.social's hosted connection page (limited to those four) and returns the agent to AAC.
2. **Add/Edit Listing → "Promote This Listing"** section just above Save/Publish:
   - One checkbox per connected platform; unconnected platforms show "Connect" instead.
   - First publish: the agent's choices become that listing's social defaults.
   - Later edits: the listing's defaults are pre-checked; unchecking skips only this save and never changes the defaults.
   - Collapsed "Preview / Edit Social Post" shows the generated caption; edits apply only to this post, not the listing description.
   - Hidden completely when the new status is Temporarily Withdrawn or Cancelled; returns when the listing moves back to an eligible status. Off Market is eligible.
3. **After Save**: the listing saves first, always. Then a message: "Listing saved — social post queued for Facebook, Instagram…", or "Listing saved. Social publishing failed for [platform]. Retry".

## Caption headline (first match wins)
Initial publish (JUST LISTED / OFF MARKET / COMING SOON based on status), then status change (BACK ON MARKET, PENDING, UNDER AGREEMENT, JUST SOLD, etc.), then price change (PRICE REDUCED / PRICE UPDATED), then open house (OPEN HOUSE), then general update (UPDATED). Body: address, price, beds/baths, a short description, the existing AAC agent attribution, and the public listing link. Threads is trimmed to 500 characters on the server.

## Photo
The listing's existing hero photo, uploaded once to bundle.social and reused across platforms. With no usable photo: Instagram (and any other image-required platform) is shown as blocked with a clear reason; text/link platforms can still go ahead.

## Public link
Reuses the existing public/shared listing page. Before building, I'll confirm exactly which existing page is safe for anonymous visitors (candidates in the app today: the consumer property page and the `/link/:token` share handler) and use it unchanged. No new public pages, no access-rule changes, no DCMLS changes.

## Not touched
Hot Sheets, match emails, communications settings, activation, listing search, Success Hub Listing Activity, DCMLS, status definitions, public-access rules, existing email sending, and the existing listing save logic (social runs only after a successful save).

## Verification before handing back (all 13 checks from your spec)
Cross-agent isolation (Agent A cannot read or post via Agent B's team), defaults stored on first publish, pre-checked on edit, one-time unchecking, no prompt for Temporarily Withdrawn / Cancelled, Off Market allowed, price and open-house changes trigger it, listing saves with bundle.social down, retry creates no duplicate, the API key never appears in the browser bundle or network traffic, and the link opens only the public listing page. Then I report the draft preview plus the exact files, migrations, functions and behavior changed, and stop.

---

## Technical details

**Database (one migration, grants + RLS on every table)**
- `agent_social_accounts`: agent_id (unique, FK auth.users), bundle_team_id (unique), timestamps. Agent: select own. Writes only via service role. Admin select via `has_role`.
- `listing_social_defaults`: listing_id (PK, FK listings), facebook/instagram/linkedin/threads booleans default false, timestamps. Agent: select/insert/update only when they own the listing (existing listing-ownership check incl. delegates via `effective_agent_id`/`can_act_for_agent`). Admin select.
- `listing_social_events`: id uuid, listing_id, agent_id, event_type, platforms text[], caption, image_url, bundle_upload_id, bundle_post_id, reference_key (unique), status (`queued|published|failed|skipped`, CHECK), failure_detail (display-safe), client_request_id (unique per listing), timestamps. Agent: select own. Inserts/updates via service role only. Admin select.
- No OAuth tokens or provider passwords stored.

**Edge functions (all JWT-validated in code, Zod input, key via `Deno.env.get("BUNDLE_SOCIAL_API_KEY")`, `x-api-key` header, provider status/body surfaced)**
- `social-connect-portal`: verifies active agent; creates the Bundle team once (`POST /api/v1/team`, guarded by the unique agent_id row + insert-on-conflict so double clicks cannot create two teams); returns the hosted portal URL restricted to FACEBOOK, INSTAGRAM, LINKEDIN, THREADS with a return URL to Settings.
- `social-accounts-status`: returns connected/not connected per platform for the caller's own team only.
- `social-publish-listing`: input { listing_id, client_request_id, event_type, platforms, caption? }. Checks ownership, re-reads the listing, rejects temporarily_withdrawn / cancelled / canceled, intersects platforms with the agent's actually connected accounts, enforces per-platform limits, inserts the event row (unique client_request_id makes repeats return the existing event), uploads the hero photo, then `POST /api/v1/post` with all selected `socialAccountTypes` in one request and `referenceKey = aac-social:{event_id}`. Retry reuses the same event id and referenceKey, so bundle.social deduplicates too.

**Frontend**
- Settings: new Social Media section in the existing agent settings page.
- New `PromoteListingSection` component used by the Add/Edit listing flow; it computes event type by diffing pre-save vs post-save status, price and open-house fields, and calls `social-publish-listing` only after the existing save resolves successfully. A `client_request_id` is generated once per save attempt so double-clicks and retries map to one event.
- No new listing statuses; uses `LISTING_STATUS` constants.

**Open items I'll confirm during the build (and flag if they differ)**
- Whether plain `withdrawn` should also be excluded (your spec names Temporarily Withdrawn and Cancelled only; the app has both `withdrawn` and `temporarily_withdrawn`). V1 as written excludes only `temporarily_withdrawn`, `cancelled`, and its `canceled` alias.
- Which existing page is the anonymous-safe public listing link.
