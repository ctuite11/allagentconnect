# Share Listings Email Unification

## Goal

Both `send-listing-share` (single) and `send-bulk-listing-share` (bulk) currently build standalone inline HTML (navy/black headers, emoji icons, no AAC branding, no footer/unsubscribe). Route both through the canonical AAC system (`buildAacEmail` via `renderEmailTemplate.ts`) so they look like the rest of the app's transactional emails.

## Key existing facts

- `_shared/sendEmail.ts` already does: `job.payload.html || renderEmailTemplate(job.payload.template, job.payload.variables)`. Today both share functions set `payload.html`, which **short-circuits** the AAC renderer. Removing `html` and passing rich `variables` is all that's required to engage the AAC shell.
- `renderEmailTemplate.ts` already has a partial `case "listing-share"` (will be upgraded). No `bulk-listing-share` case exists yet (will be added).
- `buildAacEmail()` provides the unified shell (logo/monogram, headline, body, optional CTA, footer/preheader). All other transactional emails already use it. We will rely on whatever footer/branding `buildAacEmail` already renders — no template-shell edits.

## Changes

### 1. `supabase/functions/_shared/renderEmailTemplate.ts`

**Upgrade `case "listing-share"`** to render a richer single-listing card (photo, price, address line, beds/baths/sqft/property type/year built, description, optional personal message, agent contact block) — all assembled as inline-styled HTML inside `buildAacEmail({ headline: "Property Shared With You", body, ctaLabel: "View Property", ctaUrl: variables.listingUrl })`. No emoji. Use existing AAC palette (Primary `#0E56F5`, neutrals `#0f172a / #475569 / #e5e7eb`).

**Add `case "bulk-listing-share"`** that renders a list of listing cards (photo, price, address, beds/baths/sqft, property type) using the same card style as the upgraded single-share, wrapped in `buildAacEmail({ headline: "Properties Shared With You", body, ctaLabel?: undefined })`. No emoji. Includes greeting line, optional personal message block, and agent contact block.

**Add a small shared helper** at the top of the file (or in a new `_shared/listingShareCards.ts` if it grows): `renderListingShareCard(listing)` and `renderAgentContactBlock({ agentName, agentEmail, agentPhone })`, used by both cases so the visual is identical.

### 2. `supabase/functions/send-listing-share/index.ts`

- Delete the inline `htmlContent` template (lines 56–110).
- Enqueue with `template: 'listing-share'` and pass full `variables`:
  - `recipientName`, `agentName`, `agentEmail`, `agentPhone`, `message`
  - `listing` data: `address`, `city`, `state`, `zipCode`, `price`, `bedrooms`, `bathrooms`, `squareFeet`, `propertyType`, `yearBuilt`, `description`, `photoUrl` (resolved from `listing.photos[0]` using same logic as today)
  - `listingUrl` (built from `APP_URL` + `/listings/{id}` for CTA)
- Do NOT set `payload.html`. The renderer takes over.
- Keep `subject: "Property Shared: {address}"`, `reply_to: agentEmail`, `provider: "resend"`.

### 3. `supabase/functions/send-bulk-listing-share/index.ts`

- Delete the inline `listingsHtml` and `emailHtml` template builders (lines 112–184).
- Enqueue with `template: 'bulk-listing-share'` and pass `variables`:
  - `recipientName`, `agentName`, `agentEmail`, `agentPhone`, `message`
  - `listings`: array of normalized listing objects (same shape used by the shared card helper)
  - `listingCount`
- Do NOT set `payload.html`.
- Keep subject pattern, `reply_to`, rate-limit guard, and provider unchanged.

## Out of scope (explicit)

- No frontend changes (`ShareListingDialog`, `BulkShareListingsDialog`, `EmailShareModal` untouched).
- No DB schema changes.
- No edits to `aacEmailTemplate.ts` (footer/branding/unsubscribe live there already and apply automatically via `buildAacEmail`).
- No changes to `process-email-queue`, `sendEmail.ts`, Resend wiring, or `email_jobs` table.
- No new edge functions; no migration of these to `send-transactional-email`.

## Verification

1. `npm run build` — type-check passes.
2. Deploy `send-listing-share` and `send-bulk-listing-share`.
3. Trigger a single share from the UI → confirm row in `email_jobs` with `payload.template = 'listing-share'`, no `payload.html`, `payload.variables` populated.
4. Trigger a bulk share → confirm same for `bulk-listing-share`.
5. Tail `process-email-queue` logs → confirm `delivery_status = 'sent'` and `provider_message_id` populated.
6. Spot-check one rendered email in Resend dashboard / inbox: AAC monogram header present, footer present, no emoji, brand colors applied, listing card(s) render correctly with photo + price + address.

## Risk / rollback

Low risk: queue + provider path is unchanged. If a rendered email looks wrong, revert the two function files (single git revert) and redeploy — the legacy inline HTML is preserved in git history.
