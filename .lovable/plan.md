## Goal

Move the following 16 verified agents back to the Early Access list so they appear under "Pending" in Admin Approvals and the License Verified email can be re-sent through the UI.

**Excluded (stay verified):** Erica Covelle, Emily Dugal, Michelle Hediger, Patrick Bateson, Chris Tuite.

**Converting to Early Access / Pending (16):**
Jon Mehr, Patricia Donovan, Lindsay Higgins, Jeffrey Goldman, Laura Wauters, Kiernan Middleman, Kimberlee Meserve, Murat Arslan, sean quirk, Rahel Choi, yoni Haiminis, Elizabeth Herald, John Paul Moran, Charles Joseph, Betsy McCombs, Maria del Carmen Vera-Diaz.

## Changes (data only, no code)

1. **`agent_settings`** for the 16 user_ids:
   - `agent_status` → `'pending'`
   - `verified_at` → `NULL`
   - `early_access` → `true`
   - `approval_email_sent` → `false` (so the License Verified email can be re-sent)

2. **`agent_early_access`**: insert a row for each of the 13 agents not already present (3 — Jon, Laura, Kimberlee — already exist). Populate from `agent_profiles` (email, first_name, last_name, phone, brokerage, license_state, license_number where available).

3. **Auth accounts left intact.** They keep their existing logins; only their app-side status changes. No emails are sent by this change — you trigger the License Verified email from Admin UI when ready.

## Out of scope

- No code edits.
- No automated email sending.
- No deletion of auth users or profile rows.

## Verification

After the data change, the Admin Approvals "Pending" tab should list these 16 agents and "Verified" should drop to 5 (Covelle, Emily, Michelle, Bateson, Chris).
