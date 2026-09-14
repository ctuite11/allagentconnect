# Admin "Create Listing for Agent" (Concierge)

AAC staff enter a listing on behalf of an existing member. No sign-in as the agent, no impersonation, no access to passwords or account credentials.

## What the audit found

- Every listing already stores an owner (`agent_id`) plus internal creation fields that are perfect for this: who entered it, what source it came from, which function created it, and a request ID. There is also a separate internal audit log that records every listing creation, update and deletion with the acting person and timestamp.
- Today the rules only allow someone to save a listing under their own name. An admin cannot save a listing under another member's name from the browser — so this needs a small server-side action instead of loosening those rules.
- The system already accepts an admin-entered listing at the database level and records it as an admin action, so no security rules need to be weakened.
- Statuses in use: Draft, Coming Soon, Active, Pending, Under Contract, Sold, Cancelled, Withdrawn, Temporarily Withdrawn, Off Market, Expired, Back on Market. All existing status rules and validations stay exactly as they are.

## Will this send any emails or alerts?

- **Draft sends nothing.** New listing alerts and Hot Sheet matching only fire for live statuses (Active, Coming Soon, Off Market, etc.). A draft is completely silent.
- **Any live status sends the normal alerts** — exactly the same ones a member's own listing would send. Nothing new is added.

Because of that, concierge listings are **created as Draft**. The member reviews and publishes it themselves, at which point normal alerts fire as usual. An admin can still publish directly, but only through an explicit "publish now" confirmation that warns alerts will go out.

Testing safety: all testing is done with Draft listings only, and the email queue is checked before and after to confirm zero new rows. No test listing is published.

## Workflow

1. Admin opens **Create Listing for Agent** from the Admin area.
2. Admin searches the member directory by name, email or brokerage and selects the member. Only verified, activated members are selectable. No account or login information is shown — name, brokerage, public email only.
3. Admin fills in the same listing form used by the normal Add Listing flow (same fields, same validation, same address verification, same photo handling).
4. Saving creates the listing owned by the selected member, as a Draft.
5. The member signs in and sees it in their listings like any other — edit, publish, or remove, with normal public attribution as the listing agent.

## Audit trail

Stored internally on the listing and in the listing audit log, never shown publicly:

- owning member
- admin who entered it (user ID)
- created timestamp
- source marked `admin_concierge`

Visible only inside Admin (a small "Entered by AAC staff" note on the admin view of that listing).

## Technical changes

**No schema migration required.** `listings.created_by_user_id`, `creation_source`, `created_via_function`, `creation_request_id` and `listing_audit_events` already exist and already capture this. `listings_enforce_eligible_creator` already stamps them on insert.

**No RLS changes.** Existing policies stay byte-for-byte:
- `Verified agents can create listings` (own account only) unchanged — normal agents still cannot assign listings to anyone else.
- Owner read/update/delete policies unchanged, so the member controls the listing normally.

**New Edge Function `admin-create-listing-for-agent`**
- Verifies the caller's JWT and `has_role(uid,'admin')`; rejects everyone else.
- Validates the target is an existing verified + activated agent.
- Inserts with the service role: `agent_id = target`, `status = 'draft'`, `created_by_user_id = admin uid`, `creation_source = 'admin_concierge'`, `created_via_function = 'admin-create-listing-for-agent'`, plus a request ID for idempotency.
- Returns the new listing ID. Sends no email and enqueues no job.
- A second action `admin-update-listing-for-agent` (same gate) so an admin can keep editing the draft before handing it off, since admins cannot read another member's draft directly.

**Frontend**
- New route `/admin/create-listing` (admin-guarded like other admin pages).
- Step 1: agent picker (reuses the existing admin agent list; no auth data).
- Step 2: reuses the existing Add Listing form in a "concierge" mode — same fields and validation, but saves through the Edge Function instead of a direct write, and the status selector is locked to Draft unless the admin explicitly confirms publishing.
- Admin listing view shows the internal "Entered by AAC staff on <date> by <admin>" note.
- Nothing in the member-facing or public UI changes.

## Out of scope

No scraping or automated import. No changes to emails, notifications, Hot Sheets, Comms, listing alerts, status rules, validations, or existing RLS. No migrations applied and nothing deployed until you approve.

## Verification before handing back

- Create a concierge draft for a test member: confirm owner is the member, admin is recorded as creator, source is `admin_concierge`.
- Confirm the member can see, edit and delete it; confirm a non-admin cannot call the new action.
- Confirm `email_jobs` count is identical before and after, and no Hot Sheet event rows are created.
- Type-check and production build pass. Deploy the Edge Functions only; frontend publish waits for your go-ahead.
