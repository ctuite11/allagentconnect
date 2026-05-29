## Goal

Revise the Founding Partner invitation email (`buildFoundingPartnerBody` in `supabase/functions/send-bulk-email/index.ts`) with new headline/subheadline, the most valuable AAC features, and a mocked Buyer Dashboard screenshot.

## Copy changes

- **Headline:** "Why pay to join a network when you can help launch one?"
- **Subheadline:** "Become a Massachusetts Founding Partner and get access to private listings, active buyer demand, referrals, and pre-market opportunities before public launch."
- Drop the "Exclusive Invitation" eyebrow, the "hand-picked, not a mass campaign" paragraph, and the green "Zero cost. Zero risk. / Founder pricing locked for life." callout card.
- Remove the "Or book a 15-minute intro call with Chris" mailto link below the CTA.
- Keep signature, logo, footer, brand colors (`#0E56F5` / `#22C55E`), CTA button "Accept your invitation →".

## New benefit cards (replacing the current 4)

Each card = image + uppercase title + green divider + description. Order:

1. **Pre-market & off-market inventory** (`03-results.png`) — See coming-soon, off-market, and pocket listings before they reach the public market or MLS.
2. **Buyer need broadcasting** (`04-comms.png`) — Push qualified buyer demand directly to listing agents; surface matches the moment inventory drops.
3. **Success Hub command center** (`02-success-hub.png`) — Pipeline, buyers, listings, hot sheets, referrals, and live market activity in one dashboard.
4. **Hot Sheets & saved searches** (`06-hot-sheets.png`) — Real-time alerts for new listings, price drops, status changes, and back-on-market — shareable with buyers in one tap.
5. **Branded buyer dashboard** (new mocked screenshot — see below) — Your clients get a dedicated portal under your name: favorites, new matches, messaging, and hot sheet alerts.
6. **Verified agent referral network** (`05-network.png`) — Vetted top producers in every market with scrape-protected profiles and a clean way to send and receive referrals.

## Founding Partner perks strip (above CTA)

Compact stack, no green callout card. Three lines:
- ✓ Permanent Founding Partner badge on your profile
- ✓ Lifetime free access to Success Hub, Hot Sheets, and Communications Center
- ✓ Personalized onboarding and roadmap input

(No "direct line to Chris", no "founder pricing locked for life", no "white-glove".)

## New buyer-dashboard screenshot

The two attached screenshots show real PII (Brody tuite, chris.tuite@compass.com, 617-877-3014). Plan:

1. Use the image editor to create a single composite image at `src/assets/email/founding-partner-buyer-dashboard.png` based on the two attached screenshots, replacing:
   - Name "Brody tuite" → "Jordan Avery"
   - Email "chris.tuite@compass.com" → "jordan.avery@example.com"
   - Phone "(617) 877-3014" → "(617) 555-0142"
   - Listing addresses kept generic (already Boston, MA — fine)
2. Upload the mocked PNG to the `email-attachments` storage bucket under `early-access-v2/08-buyer-dashboard.png?v=v8` so it's served from the same `STORAGE_BASE_V2` the other email images use.
3. Reference it from the new "Branded buyer dashboard" benefit card.

## Technical scope

- Single function edited: `buildFoundingPartnerBody()` in `supabase/functions/send-bulk-email/index.ts`.
- One new storage asset uploaded (`early-access-v2/08-buyer-dashboard.png`); no code paths beyond the template reference change.
- No schema changes, no admin UI changes; template key `founding-partner-invitation` stays the same.

## Out of scope

- No changes to other templates (`early-access-update-v1/v2`, `private-listing-network`).
- No changes to `BulkEmailDialog.tsx` template list or subject defaults.
- No new edge functions, no new tables.
