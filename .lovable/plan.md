# Public shared-listing data & contact boundary (backend only)

## Confirmed by live testing just now

- Anonymous callers **can** read published listings with `select("*")`. A real anonymous request returned `showing_instructions` ("Call Dan Keating 617-680-7785…") along with `lockbox_code`, `broker_comments`, `commission_rate`, `additional_notes` — currently null on those rows, but readable columns. The exposure is real.
- The row policy "Anyone can view published listings" is granted to `public` (which includes anonymous) for 13 statuses: active, new, coming_soon, off_market, back_on_market, price_changed, extended, reactivated, under_agreement, pending, contingent, sold, rented. Draft is already excluded.
- `agent_profiles` is **already** closed to anonymous — a direct anonymous read returns `permission denied`. Its only read policy is authenticated-only. So the logged-out property page currently cannot show agent contact at all.
- Sensitive listing columns present: `lockbox_code`, `showing_instructions`, `showing_contact_name`, `showing_contact_phone`, `broker_comments`, `additional_notes`, `commission_rate`, `commission_type`, `commission_notes`.
- `social-preview` fetches `select("*")` by ID with the service role and no status check, so a draft ID does produce a preview.

## 1. Safe public listing payload

Add a security-definer function `public.get_public_listing(p_listing_id uuid)` that:

- looks up the listing by ID,
- returns nothing unless the status is in the public-eligible set (the existing 13 statuses; draft and any non-listed status fail closed),
- returns only marketing fields: identity/address/geo, price fields, beds/baths/sqft/lot/year, property & listing type, description, photos, public features/amenities, open-house data, status and status dates, listing number, city/county, DCMLS flags.
- explicitly excludes every column in the sensitive list above, plus internal flags.

The exact returned column list will be written out in the report.

## 2. Public listing-agent contact

The same function (or a companion `public.get_public_listing_agent(p_listing_id uuid)`) resolves the agent **through the listing's own `agent_id`** — the caller never supplies an agent ID, so it cannot be used to enumerate the directory. Returns only: first name, last name, company/brokerage, title, headshot URL, business phone/cell per the existing display preference, business email, AAC ID. No change to `agent_profiles` policies; full-table anonymous access stays denied.

## 3. Lock the columns

Replace anonymous whole-row access with column-scoped access on `public.listings` so sensitive columns are unreadable anonymously even with a hand-crafted request. Authenticated agent/owner/admin access is untouched.

**Sequencing decision needed.** Once anonymous column access is narrowed, an anonymous `select("*")` fails, and the public property page currently does exactly that. Two ways to run it:

- **A (recommended): ship both together.** Land the safe function now, then apply the column lock as the frontend cutover ships. Shortest exposure window with no broken public page.
- **B: lock immediately.** Sensitive fields close today, but the logged-out property page breaks until the frontend switches to the new function.

I'll assume A unless told otherwise, and will call out the exact moment the lock is ready to apply.

## 4. Contact form delivery

`send-contact-email` will accept a listing ID instead of an agent email, resolve the listing and its agent server-side, verify public eligibility, and refuse otherwise. Turnstile verification and the existing per-IP rate limit stay; the recipient can no longer be attacker-controlled. `send-showing-request-email` gets the same treatment — it currently takes `agentEmail` from the caller.

## 5. Social preview

`social-preview` will check listing eligibility and return 404 for draft or non-eligible listings before rendering Open Graph tags, and will select only the fields it renders.

## Out of scope (untouched)

RouteGuard, AAC dashboards, Hot Sheets, messaging permissions, Communications, listing ownership, buyer attribution for authenticated buyers, listing status/history. No frontend changes. No emails sent during testing except, if strictly necessary, a single controlled test to the admin address.

## Report back after implementation

Exact public listing fields, exact agent fields, proof sensitive fields are anonymously unreadable, proof `agent_profiles` stays protected, proof draft IDs fail on both the data path and the social preview, proof the contact and showing paths resolve the agent server-side, confirmation no authenticated workflow changed, and the list of migrations/functions/policies touched plus the tests run.
