# DCMLS wording + opt-in handoff + Buyer Agent Compensation Yes/No

Four separate fixes, shipped separately. No changes to DCMLS backend eligibility, Hot Sheets, social publishing, or Rental listings.

## 1. Draft DCMLS badge says "Confirmed", not "Published"
- Add/Edit Listing DCMLS control currently shows "Published" whenever `dcmls_status === "published"`, regardless of listing lifecycle.
- New display rule (UI only):
  - real listing status is Draft (or never saved) + DCMLS selected -> **Confirmed**
  - live listing + `dcmls_status = published` -> **Published**
  - Hidden / Error unchanged
- `dcmls_status` values and gating rules unchanged. Agent-level wording stays Participating / Not Participating.

## 2. Opt-in -> Profile handoff popup
- After a successful participation opt-in from Add/Edit Listing or Settings, show:
  - Title: "You're opted in to Direct Connect MLS"
  - Body: "Complete your DCMLS profile settings to choose your buyer-lead coverage, seller-lead preferences and incentives."
  - Buttons: "Go to Profile" / "Not Now"
- "Go to Profile" opens the Profile editor with an anchor that scrolls to the DCMLS settings section.
- Shown only after a confirmed opt-in; never checks or publishes the current listing. On Add Listing, unsaved form work is not lost (Not Now keeps the agent on the form; Go to Profile warns/saves as current navigation does).

## 3. DCMLS Profile settings — current state and gap
Found today:
- Buyer incentives and seller incentives exist on the agent profile as free-text fields (already editable in the Profile editor).
- No field exists for buyer-lead ZIP coverage or "Receive seller leads: Yes/No".

Plan:
- Add a clearly labeled **DCMLS settings** section to the Profile editor (anchor target for #2), containing:
  - Buyer-lead ZIP coverage (ZIP list input)
  - Receive seller leads: Yes / No
  - Buyer incentives and Seller incentives (reusing the existing profile fields — moved into this section, not duplicated)
- New columns via migration on the agent profile: `dcmls_buyer_lead_zips text[]` (nullable), `dcmls_receive_seller_leads boolean` (nullable). Owner-only write, existing profile RLS applies.
- These values are stored only; nothing consumes them for lead routing yet. Not tied to Communications/Hot Sheet preferences.

## 4. Buyer Agent Compensation — required Yes/No (For Sale only)
- Section renamed "Buyer Agent Compensation" with required radio: "Is buyer-agent compensation offered? *" Yes / No.
- Yes: Percentage / Flat Amount, Rate or Amount, Compensation Notes stay active; amount required to publish.
- No: type and amount controls disabled/hidden; saves as explicitly not offered; amount cleared on save so no stale value remains.
- Required only when going live (first-publish review and live edits); Save Draft / autosave may leave it unanswered.
- Listing detail page: shows compensation only when offered = true and an amount exists; when false shows nothing (or "Not offered" — see question below).

Data:
- New column `listings.buyer_agent_compensation_offered boolean` nullable (null = unanswered).
- Form hydration: existing listings with a real `commission_rate` display as Yes; others stay unanswered. No blanket backfill.

## QA (no real publish)
1. Draft + DCMLS checked -> "Confirmed".
2. Opt-in from Add Listing -> popup -> Go to Profile lands on DCMLS settings (test on a non-participating test account, or verify with a reversible toggle only if authorized).
3. Opt-in does not check or publish the listing.
4. Publish blocked until Yes/No answered (validation summary, stops before "Yes, Publish Listing").
5. Yes -> amount required. 6. No -> fields inactive, nothing shown on the detail page.
7. Save Draft works unanswered.

## Technical details
- Files: `src/components/listing/DcmlsPublishControl.tsx` (badge + popup trigger; needs listing lifecycle prop), `src/pages/AgentSettings.tsx` (popup after opt-in), new small `DcmlsOptInHandoffDialog`, `src/pages/AgentProfileEditor.tsx` (DCMLS section + anchor), `src/pages/AddListing.tsx` (radio, validation, payload, hydration), `src/components/PropertyDetailRightColumn.tsx` (display guard).
- Two migrations (profile DCMLS columns; listings compensation boolean), each additive and nullable. Requires your go-ahead as production schema changes.
