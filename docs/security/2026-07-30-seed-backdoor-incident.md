# Incident Report — Production Seeding Backdoor (`seed-test-agents`)

**Incident date:** 2026-07-30 17:51 UTC
**Report created:** 2026-07-30 (evidence snapshot captured BEFORE any purge)
**Status:** Contained
**Email sending:** `EMAIL_SENDING_PAUSED=true` — unchanged throughout.

---

## 1. Root cause

| Layer | Defect |
| --- | --- |
| Frontend | Public route `/seed-test-data` (`src/pages/SeedTestData.tsx`) rendered with **no** `RouteGuard`. |
| Backend | Edge Function `seed-test-agents` deployed with `verify_jwt = false`, no `auth.getUser` check, no admin-role check, using the **service-role** client. |
| Effect | Any anonymous visitor could create confirmed auth users, grant them the `agent` role, create `agent_profiles`/`agent_settings`/coverage preferences, and insert **active** listings. |
| Credential exposure | Hardcoded shared password `TestPassword123!` for all 10 seeded accounts (rotated/invalidated by account deletion). |

## 2. Compromised accounts (evidence snapshot)

All created by the backdoor in a 16-second burst, 17:51:11–17:51:27 UTC. All `email_confirmed_at` set at creation (auto-confirmed, no signup flow), provider `email`.

| # | User ID | Email | AAC ID | Created (UTC) | Last sign-in | Sessions / refresh tokens |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 4a03694a-2815-47e6-9016-dcbef519c589 | sarah.johnson@allagentconnect.com | AAC-0334 | 17:51:11 | **17:52:25** | **4 / 4** |
| 2 | 0999e167-7fe3-4932-8ee0-9ce114b8a07a | michael.chen@allagentconnect.com | AAC-0335 | 17:51:14 | never | 0 / 0 |
| 3 | 50c23819-8266-4907-a690-fabc06027cf8 | jennifer.murphy@allagentconnect.com | AAC-0336 | 17:51:15 | never | 0 / 0 |
| 4 | 371618ce-129a-4847-b8c7-e7af69ff8cb4 | david.walsh@allagentconnect.com | AAC-0337 | 17:51:17 | never | 0 / 0 |
| 5 | 79caccc7-e163-4b1d-89bf-22ceeb433e71 | emily.rodriguez@allagentconnect.com | AAC-0338 | 17:51:19 | never | 0 / 0 |
| 6 | 0f79522d-311a-4ba3-aca8-8f0b378ba24a | robert.thompson@allagentconnect.com | AAC-0339 | 17:51:20 | never | 0 / 0 |
| 7 | dd03915e-26db-43d9-9d2e-c4ca900848a2 | amanda.silva@allagentconnect.com | AAC-0340 | 17:51:22 | never | 0 / 0 |
| 8 | aab9cfcf-b2b2-4d4e-a67f-0d4264ffc86b | christopher.lee@allagentconnect.com | AAC-0341 | 17:51:23 | never | 0 / 0 |
| 9 | ef366028-b34b-405c-803d-62d91062ae9e | lisa.anderson@allagentconnect.com | AAC-0342 | 17:51:25 | never | 0 / 0 |
| 10 | 48fa79ee-709b-4154-b509-70c2a488697f | james.mccarthy@allagentconnect.com | AAC-0343 | 17:51:27 | never | 0 / 0 |

Explicitly **excluded** (legitimate): `chris@allagentconnect.com`, `boo@allagentconnect.com`.

### Privilege escalation observed

`agent_verification_audit` shows sarah.johnson **self-verified**, acting as her own admin:

```
17:51:50Z  pending  -> verified   admin_user_id = agent_user_id = 4a03694a-…
17:52:11Z  verified -> pending    admin_user_id = agent_user_id = 4a03694a-…
17:52:25Z  successful sign-in (session established, 4 refresh tokens)
```

### Application footprint at time of snapshot

| Table | Column | Rows |
| --- | --- | --- |
| profiles | id | 10 |
| agent_profiles | id | 10 |
| agent_settings | user_id | 10 |
| user_roles | user_id | 10 (role `agent`) |
| agent_state_preferences | agent_id | 10 |
| agent_county_preferences | agent_id | 14 |
| agent_verification_audit | agent_user_id / admin_user_id | 2 / 2 |
| listings | agent_id | 0 (22 already hard-deleted earlier in the incident) |

A full sweep of **every** uuid column of **every** public base table (via `information_schema` + `query_to_xml`) returned no other rows referencing these 10 IDs — no hot sheets, clients, workspaces, conversations, teams, delegates, notification preferences, favorites, or email jobs addressed to them.

Seeded profile content (all fake, all `…@allagentconnect.com`): companies "Boston Realty Group", "Metro Properties", "Cape Cod Estates", "Western Mass Realty", "North Shore Properties", etc.; phones in the `555-01xx` reserved range; no headshots.

## 3. Email impact — corrected statement

```
Emails ADDRESSED TO the seed accounts:              none identified
Emails GENERATED BECAUSE OF seed listings:          3,796 (all sent before the pause)
```

The seed listings were inserted with status `active`, which fired the live listing-notification pipeline to **real** verified agents.

### Per-seeded-listing reconciliation (22 listings, listing numbers L-1251…L-1272, agent = the 10 seed accounts)

Listing rows were hard-deleted earlier in the incident, so reconciliation is by address from `email_jobs` payloads. All jobs created 17:51:15–17:51:31 UTC; all `sent`; zero queued; zero failed.

| Address | Jobs | Sent | Queued | Failed | Unique real-agent recipients |
| --- | --- | --- | --- | --- | --- |
| 456 Commonwealth Ave, Boston, MA | 175 | 175 | 0 | 0 | 175 |
| 25 Harvard Street, Cambridge, MA | 175 | 175 | 0 | 0 | 175 |
| 123 Beacon Street, Boston, MA | 174 | 174 | 0 | 0 | 174 |
| 789 Marlborough Street, Boston, MA | 174 | 174 | 0 | 0 | 174 |
| 500 Main Street, Worcester, MA | 174 | 174 | 0 | 0 | 174 |
| 88 Lincoln Street, Worcester, MA | 174 | 174 | 0 | 0 | 174 |
| 300 Huntington Ave, Boston, MA | 173 | 173 | 0 | 0 | 173 |
| 200 Harbor Road, Yarmouth, MA | 173 | 173 | 0 | 0 | 173 |
| 100 Ocean Drive, Hyannis, MA | 173 | 173 | 0 | 0 | 173 |
| 45 Sea View Lane, Barnstable, MA | 173 | 173 | 0 | 0 | 173 |
| 150 Lafayette Street, Salem, MA | 173 | 173 | 0 | 0 | 173 |
| 88 Washington Street, Marblehead, MA | 173 | 173 | 0 | 0 | 173 |
| 75 Sandwich Street, Plymouth, MA | 173 | 173 | 0 | 0 | 173 |
| 200 Water Street, Plymouth, MA | 173 | 173 | 0 | 0 | 173 |
| 75 College Highway, Northampton, MA | 173 | 173 | 0 | 0 | 173 |
| 350 Maple Street, Springfield, MA | 173 | 173 | 0 | 0 | 173 |
| 50 Main Street, Natick, MA | 173 | 173 | 0 | 0 | 173 |
| 225 Union Avenue, Framingham, MA | 173 | 173 | 0 | 0 | 173 |
| 400 County Street, New Bedford, MA | 173 | 173 | 0 | 0 | 173 |
| 125 South Main Street, Fall River, MA | 173 | 173 | 0 | 0 | 173 |
| 88 Prospect Street, Somerville, MA | 171 | 171 | 0 | 0 | 171 |
| 75 Tremont Street, Boston, MA | 164 | 164 | 0 | 0 | 164 |
| **Total (22 seeded listings)** | **3,796** | **3,796** | **0** | **0** | ~175 distinct agents, each hit ~22× |

### The 23rd listing in the email burst — identified

`45 1st Avenue, Boston, MA` — **not a seeded listing**.

| Field | Value |
| --- | --- |
| Listing | L-1217 · `85011fb9-a89c-4a8e-bb55-a89cdd620fd4` |
| Agent | Daniel O'Leary · `ed898f65-2ee7-4ae0-b572-80e5422ab312` · daniel.oleary@compass.com (real, legitimate) |
| Listing created | 2026-06-29 19:27 UTC |
| Emails triggered | 2026-07-30 18:14:51 UTC (status change to `active`, ~23 min after the seed burst) |
| Jobs | 169 total · 95 sent · 74 queued (stopped mid-flight by the email pause) · 0 failed · 169 unique recipients |

So the "23-listing burst" = 22 backdoor listings + 1 legitimate listing status change that happened to land in the same window. Root cause of *that* fan-out is the broad notification pipeline (addressed separately in PR #33), not the backdoor.

No email jobs were modified, retried, requeued, cancelled or drained during this investigation.

## 4. Evidence gaps

- `function_edge_logs` for `seed-test-agents` returned **zero rows** for the 17:40–18:30 UTC window — the analytics retention window no longer covers the invocation, so caller IP, user-agent and JWT subject are **unavailable**. The invocation is inferred from the auth-user creation burst, its exact ordering/timing matching the function's hardcoded agent array, and the sign-in with the hardcoded password.
- The 22 listing rows were hard-deleted before this snapshot; addresses, timings and email fan-out are recovered from `email_jobs` payloads (above).
- No passwords, tokens, or service keys are recorded in this document.

## 5. Remediation applied

1. Deployed Edge Function `seed-test-agents` **deleted** from the project (endpoint no longer exists).
2. `supabase/functions/seed-test-agents/`, `src/pages/SeedTestData.tsx`, the `/seed-test-data` route and its `App.tsx` import removed; `config.toml` entry removed.
3. `seed-proposal-test-data` (sibling seeding function) deleted and undeployed as well.
4. All 10 accounts purged: sessions/refresh tokens revoked, roles/profiles/settings/preferences/verification-audit rows deleted, then `auth.users` deleted.
5. Listing creation now requires `verified + activated + agent role` at the database level (see `listings_require_eligible_agent` trigger).
6. Durable listing creation provenance added (`listing_audit_events`, append-only).
7. CI guard `scripts/security/check-no-seed-backdoors.mjs` fails the build on new seed routes/functions, unauthenticated `auth.admin` usage, and hardcoded shared passwords.

## 6. Sibling privileged-function audit

See `docs/security/2026-07-30-privileged-function-audit.md`.