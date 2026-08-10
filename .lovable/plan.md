# Public shared-listing boundary — Phase 1 (additive backend only)

Approved: Option A, staged. Phase 1 adds the safe public paths. The anonymous `listings` SELECT stays exactly as it is until the frontend has cut over.

## Confirmed by live testing

- Anonymous callers can read published listings with `select("*")`, including `lockbox_code`, `showing_instructions`, `showing_contact_name`, `showing_contact_phone`, `broker_comments`, `additional_notes`, `commission_rate`, `commission_type`, `commission_notes`.
- The public row policy covers 13 statuses (active, new, coming_soon, off_market, back_on_market, price_changed, extended, reactivated, under_agreement, pending, contingent, sold, rented). Draft already excluded.
- `agent_profiles` is already closed to anonymous (permission denied). Logged-out pages cannot show agent contact today.
- `social-preview` fetches `select("*")` by ID with the service role and no status check, so a draft ID currently produces a preview.

## Phase 1 scope

### 1. `public.get_public_listing(p_listing_id uuid)`
Returns one row of marketing-only fields: id, listing_number, address/unit/city/state/zip/county/neighborhood, lat/lng, price + price range fields, beds/baths/half baths, square_feet, lot size, year built, property_type, listing_type, description, photos, public features/amenities, open-house fields, status and status dates, DCMLS flags. Fails closed (returns zero rows) for draft and any status outside the public set.

### 2. `public.get_public_listing_agent(p_listing_id uuid)`
Resolves the agent strictly through the listing's own `agent_id` — the caller never supplies an agent ID, so it cannot be used as a directory scraper. Returns only: first name, last name, brokerage/company, public title, headshot URL, business/cell phone per the existing display preference, business email, AAC ID. Same published-status gate. `agent_profiles` policies unchanged.

### 3. Contact + showing email paths
`send-contact-email` and `send-showing-request-email` accept `listing_id` and resolve the listing, its agent, and the destination email server-side; a caller-supplied `agentEmail` is ignored. Both refuse for non-public listings. Turnstile and the existing per-IP rate limits are retained (showing-request gains the same Turnstile check only if it already has one — otherwise its existing protections are preserved unchanged).

### 4. `social-preview` hardening
Status/eligibility check before rendering; 404 for draft or non-eligible IDs. Narrow field selection instead of `select("*")`.

## SECURITY DEFINER hardening (both functions)

- explicit `SET search_path = public, pg_temp`
- fully qualified table references
- explicit column list in the RETURNS TABLE and the SELECT — never `select *`
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC`
- `GRANT EXECUTE` only to `anon`, `authenticated`, `service_role`
- fail closed on draft/non-public status

## Explicit STOP

Phase 1 ends at deployed + verified. No change to anonymous `listings` SELECT, no policy narrowing, no column grants removed. Phase 3 (revoke anonymous direct table SELECT, prove the sensitive fields are unreachable) is a separate authorization after Cursor's frontend cutover is verified in production.

## Not touched

RouteGuard, AAC dashboards, Hot Sheets, Communications, messaging permissions, listing ownership, listing status/history, authenticated buyer attribution. No frontend changes. No emails sent during testing except, if strictly necessary, a single controlled test to the admin address.

## Report back

Exact RPC signatures and returned field lists for both functions, the published-status set enforced, proof draft IDs fail on the data path and the social preview, proof the contact/showing paths resolve the recipient server-side, confirmation `agent_profiles` remains closed to anonymous, confirmation anonymous listing access is unchanged in Phase 1, and the list of migrations/functions changed plus tests run.
