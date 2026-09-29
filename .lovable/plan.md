# DCMLS participation locations + listing control + Buyer Agent Compensation Yes/No

No changes to Hot Sheets, social publishing, Rental listings, or DCMLS backend eligibility.

## Already done (before this correction)
- Added nullable columns: `listings.buyer_agent_compensation_offered`; on private `agent_settings`: `dcmls_buyer_lead_zips`, `dcmls_receive_seller_leads`, `dcmls_buyer_incentives`, `dcmls_seller_incentives`. Public `agent_profiles` untouched.
- Add Listing: compensation Yes/No form state, hydration (real amount -> Yes, otherwise unanswered), first-publish validation, and "No" clears the saved amount. The on-screen Yes/No choice is not built yet.

## 1. Participation opt-in only in Settings and Profile
**Settings**
- Keep the Opt In / Opt Out switch.
- After a successful Opt In, show a popup: "You're opted in to Direct Connect MLS" / "Complete your DCMLS profile settings to choose your buyer-lead coverage, seller-lead preferences and incentives." with buttons **Go to Profile** and **Not Now**.
- Go to Profile opens the Profile editor scrolled to the DCMLS settings section.

**Profile — new "DCMLS settings" section**
- DCMLS Participation: Opt In / Opt Out (same saved setting as Settings). No popup here; opting in just shows the fields below.
- Buyer-lead ZIP coverage (ZIP list)
- Receive seller leads: Yes / No
- Buyer incentives (multi-select)
- Seller incentives (multi-select)
- Saved to private agent settings only. Kept separate from Communications / Hot Sheet preferences. Existing free-text profile incentive fields are left as they are.

## 2. Add/Edit Listing — listing-level decision only
- Remove the "Opt in to DCMLS" button.
- Participating: "Show this listing on DCMLS: Yes / No".
- Not participating: choice disabled, with the message "You're not participating in Direct Connect MLS. Manage DCMLS in Profile or Settings." and links to both. The listing form never changes participation.

## 3. Draft wording
- Draft / never published + DCMLS selected -> **Confirmed**
- Live listing + DCMLS published -> **Published**
- Hidden / Error unchanged. Wording only; saved DCMLS status values unchanged.

## 4. Buyer Agent Compensation (For Sale) — finish the screen
- Required choice: "Is buyer-agent compensation offered? *" Yes / No.
- Yes: Percentage / Flat Amount, amount (required to publish), notes.
- No: type and amount hidden; saves as not offered.
- Save Draft / autosave may leave it unanswered; required only at first publish.
- Listing page: Yes + amount -> show it; No -> "Buyer Agent Compensation: Not offered"; unanswered -> nothing.

## QA (no real publish)
1. Change participation from Settings -> popup -> Go to Profile lands on DCMLS settings.
2. Change participation from Profile (no popup); fields appear.
3. No Opt In button on Add/Edit Listing; non-participant sees Profile/Settings guidance.
4. Participant can choose Yes/No for the listing.
5. Selected Draft shows Confirmed.
6. Publish blocked until compensation Yes/No answered (stop at validation); Save Draft works unanswered.
Any participation toggling on a real account is reversed to its starting value afterward.

## Technical details
- `DcmlsPublishControl.tsx`: drop opt-in button/handler and `onOptedIn`; add `listingIsDraft` prop for Confirmed badge; guidance text with links to `/agent/profile#dcmls-settings` and `/settings`. Update AddListing and EditListing callers (EditListing passes `originalStatus === "draft"`).
- New `DcmlsOptInHandoffDialog.tsx`, used only by `AgentSettings.tsx` after a successful opt-in.
- `AgentProfileEditor.tsx`: `id="dcmls-settings"` section reading/writing via `useAgentSettings` (add the four new fields to its type/defaults); scroll to hash on load.
- `AddListing.tsx`: Yes/No radio UI and field error highlighting.
- `PropertyDetailRightColumn.tsx`: compensation display rule above.
- Incentive option lists defined in one constants file.
