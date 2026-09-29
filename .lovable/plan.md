# DCMLS consumer incentives — gated details + Compare Agents

The private Profile incentive settings stay exactly as built.

## What consumers see
1. **Public agent profile** (public/DCMLS agent profile page):
   - If the agent has buyer incentives (any choice other than "No incentive offered"): "Buyer incentives available", subtext, **Get Buyer Incentive Details**.
   - Same for sellers: "Seller incentives available", **Get Seller Incentive Details**.
   - Nothing shown for a category with "No incentive offered" or nothing set. Incentive types, amounts and "More" text never shown.
2. **Lead form** (popup): Name *, Email *, **Send Me the Details**, note: "Your contact information will be shared with this agent so they can provide the incentive details. No phone number required." Records Buyer vs Seller. After sending: a thank-you message only, no details revealed.
3. **Compare Agents** (secondary text-style button under the main CTA): heading "Compare with other agents serving this area", up to 3 other eligible agents, cards with photo, name, brokerage, service area, "Buyer/Seller incentives available", **Get Incentive Details** (same form), **View Profile**. No ranking, numbering, "Best Match", featured or paid placement; random rotation.
   - Buyer: participates in DCMLS, has buyer incentives, buyer ZIP coverage includes the ZIP.
   - Seller: participates, has seller incentives, receives seller leads = Yes. Also filtered by ZIP coverage when a ZIP is known (see question below).
   - ZIP comes from the property when arriving from a listing; otherwise the consumer is asked for a ZIP first.

## Where the lead goes
New lead is saved and the agent is notified through the agent's existing in-app lead/communications inbox. No new email template (templates are frozen) unless you approve one separately.

## Not changing
Private settings stay private and off the public profile table; DCMLS participation rules, Hot Sheets, social, listing publishing, Rentals unchanged. No phone field anywhere.

## QA
Desktop + mobile on the profile page: CTAs show/hide correctly per category, form validates, lead is recorded with the right type, no details leak on screen or in page data, Compare shows at most 3 unranked eligible agents, ZIP prompt works. One test lead from a clearly fake name, deleted afterward. No listing touched.

## Technical details
- Migration: `dcmls_incentive_leads` table (id, agent_user_id, incentive_type 'buyer'|'seller', name, email, source_zip, source_listing_id, created_at) with GRANTs, RLS: agent reads own; no direct anon insert.
- Edge Functions (service role, never return private selections):
  - `dcmls-incentive-availability`: given agent id(s) returns only `{buyer: bool, seller: bool}`.
  - `dcmls-compare-agents`: given type + ZIP + exclude id returns up to 3 random eligible public profile cards.
  - `dcmls-incentive-lead`: zod-validated name (≤100) / email (≤255), rate-limited per email/IP, inserts lead and creates the agent's in-app notification.
- Components: `IncentiveAvailabilityCard`, `IncentiveLeadDialog`, `CompareAgentsPanel` using design tokens; inserted into `PublicAgentProfile` (and `AgentProfile` public view if that's the DCMLS surface).
