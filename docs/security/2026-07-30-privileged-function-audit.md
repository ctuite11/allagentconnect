# Privileged Edge Function Audit — 2026-07-30

Triggered by the `seed-test-agents` production-seeding backdoor. Every Edge Function that
uses the service-role key or the Admin Auth API was reviewed.

Authentication classifications used:

| Class | Meaning |
| --- | --- |
| `admin-jwt` | Requires a signed-in user AND `has_role(uid,'admin')` |
| `user-jwt` | Requires a signed-in user; scoped to their own data |
| `token-redemption` | Anonymous by design; a single-use secret invite/share token is the boundary |
| `webhook` | Called by a third party; signature/secret verified |
| `internal-cron` | Invoked by pg_cron / internal schedule only |
| `public-read` | Anonymous read-only rendering (OG images, sitemap, previews) |

## A. Confirmed backdoors — remediated today

| Function | Deployed? | verify_jwt | getUser | admin check | Capability | Frontend entry | Anonymous callable | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `seed-test-agents` | **was deployed** | false | no | no | `auth.admin.createUser`, `user_roles`, `agent_profiles`, `agent_settings`, **active `listings`** | `/seed-test-data` (unguarded) | **YES** | **Deleted from the project and from the repo. `/functions/v1/seed-test-agents` now returns 404.** |
| `convert-early-access-to-account` | yes | **was false** | no | no | `auth.admin.createUser` + `generateLink`, agent role/profile creation | Admin Approvals (admin UI only) | **YES (rate-limited 5/min/IP)** | **Admin JWT + `has_role` gate added; `verify_jwt = true`; redeployed. Anonymous call now returns 401.** |
| `seed-proposal-test-data` | yes | true | n/a | secret header `SEED_PROPOSAL_TEST_SECRET`, caller-scoped anon client (no service role) | proposal fixtures | none | no | **Deleted anyway — production seeding functions must not exist. Returns 404.** |

No other function was found that can create auth users, grant roles, or insert listings without authorization.

## B. Admin-gated functions — verified correct (no change)

All of these validate the caller with `auth.getUser()` **and** `has_role(uid,'admin')` before using service-role authority. Classification: `admin-jwt`.

`admin-create-user`, `admin-list-agents`, `admin-list-agent-emails`, `admin-notification-backfill`, `admin-set-user-password`, `admin-verify-agent`, `convert-pending-verification-to-agent`, `generate-agent-setup-link`, `delete-users` (admin JWT **or** service-role bearer from the pg_cron pump), `diag-listings`, `check-deleted-agent`, `remove-buyer`, `send-founder-invite`, `send-hot-sheet-preview-blast`, `send-team-decision-email`.

`delete-users` accepts service-to-service calls (cron pump) — intentional and documented in the file header.

## C. Token-redemption endpoints — anonymous by design, boundary is the token

`accept-account-delegate-invite`, `accept-buyer-workspace-invite`, `accept-client-hot-sheet-invite`, `email-unsubscribe`, `unsubscribe-hotsheet`, `track-email-click`, `track-email-open`, `send-password-reset` (email-enumeration-safe), `submit-agent-verification-request` (Turnstile), `submit-early-access` (Turnstile), `validate-agent-signup`, `verify-turnstile`.

These use `auth.admin.*` only to attach or create the account that the invite token already names. Per the incident instructions, JWT verification was **not** added to them. Residual risk: token guessing — all tokens are random UUID/opaque values with expiry and single-use acceptance.

## D. Internal cron / pipeline functions

`process-email-queue`, `kick-email-queue`, `process-comms-digests`, `process-hot-sheet`, `send-new-match-notification`, `send-price-change-notification`, `send-stale-listing-reminders`, `update-listing-statuses`, `notify-agents*`, `notify-matching-buyers`.

They mutate queues/status, not identity, and cannot create users, roles, or listings. `notify-agents-new-listing` remains disabled from the earlier email incident. All email senders remain behind the `EMAIL_SENDING_PAUSED` kill switch.

Follow-up (not done today, outside the containment scope): several of these accept unauthenticated invocation and could be triggered repeatedly by an anonymous caller — a denial-of-wallet / queue-churn risk, not a privilege-escalation risk. Recommend adding a shared internal secret header on the cron-only set.

## E. Public-read functions

`sitemap`, `social-preview`, `listing-og-image`, `get-hotsheet-preview`, `network-intelligence-aggregates`, `fetch-property-data`, `auto-fetch-property-data`, `get-city-zips`, `get-property-history`. Read-only or cache-write only; no identity capability.

## F. Permanent controls added

- `npm run security:guard` (`scripts/security/check-no-seed-backdoors.mjs`) fails on: new `/seed-*` or `/test-data` routes, seed/fixture Edge Functions, **new** unclassified `auth.admin` or service-role mutating functions, hardcoded password literals, and fixtures inserting active listings.
- `scripts/security/privileged-function-baseline.json` freezes the 46 pre-existing privileged functions listed in sections B–E. Anything new must declare `// @auth-classification: <model>`. Retiring the baseline entries is tracked follow-up work.
- Database: `listings_enforce_eligible_creator` requires `agent role + verified + activated` for every listing insert; admin/service-role inserts are permitted but written to `listing_audit_events` as an explicit audited exception.