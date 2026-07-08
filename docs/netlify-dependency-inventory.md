# Netlify Dependency Inventory

Status: **informational only** — captured during the 2026-07-08 security/publish pass. No hosting or function migration is scheduled yet. Do not delete `netlify.toml` or `netlify/functions/` on the basis of this document.

## Why this exists

Custom domains (`allagentconnect.com`, `directconnectmls.com`, `www.directconnectmls.com`) are attached to Lovable hosting via the current publish flow, but the repo still contains a full Netlify configuration and 16 Netlify Functions. Several frontend paths call `/api/*` URLs that only resolve when Netlify (or a Netlify-compatible proxy) is in front of the app. Until we confirm the production DNS/proxy split, we should assume both surfaces are load-bearing.

Long-term direction: consolidate on Lovable + Supabase Edge Functions so one deploy path controls AAC and DCMLS. Migration is deferred; this file is the checklist for that future work.

## Netlify Functions in the repo

Location: `netlify/functions/`

### Repliers IDX proxy
- `repliers-listings.ts`
- `repliers-listing-detail.ts`
- `repliers-autocomplete.ts`
- `repliers-health.ts`
- `repliers-diagnostics.ts`
- `repliers-utils.ts` (shared helper)

### ATTOM proxy
- `attom-client.ts` (shared helper)
- `attom-health.ts`
- `attom-property-enrichment.ts`

Note: `supabase/functions/` already has `fetch-attom-market-data` and `test-attom`. Reconcile scope before porting.

### Showing requests
- `request-showing.ts` (POST — security scan flagged `REQUIRE_AUTH = false` and unsanitized HTML interpolation)
- `showing-requests.ts` (GET list)

### Transactional email endpoints
- `send-password-changed-email.ts` (security scan flagged: no auth, CORS echoes origin)
- `send-pending-approval-email.ts` (security scan flagged: no auth)
- `email-worker.ts`
- `listingEmailCard.ts`
- `listingShareEmailAddress.ts`

### Other
- `aac-sync-listing.ts`

## Netlify edge functions

Referenced from `netlify.toml`:
- `social-preview` — path `/property/*` — OG preview rendering
- `request-password-reset` — path `/api/auth/request-password-reset`

## `netlify.toml` rewrites and redirects

- `/api/showing-requests` → `/.netlify/functions/showing-requests`
- `/api/send-password-changed-email` → `/.netlify/functions/send-password-changed-email`
- `/api/send-pending-approval-email` → `/.netlify/functions/send-pending-approval-email`
- `/sitemap.xml` → Supabase edge function `sitemap` (200 rewrite — already on Supabase)
- Long-lived cache headers for `/assets/*`, `/og/aac-og-v*.png`, `/email/*`
- No-cache headers for HTML shell, favicons, canonical OG image

Only Netlify processes this file. Lovable hosting ignores it.

## Frontend callers that depend on Netlify paths

Grep source of truth: `rg "\"/api/|'/api/|fetch\\(\`/api/" src`.

| Frontend file | Path called | Notes |
| --- | --- | --- |
| `src/lib/repliers.ts` | `/api/repliers/listings`, `/api/repliers/listing/:id`, `/api/repliers/autocomplete`, `/api/repliers/health` | Used by IDX beta hooks/pages |
| `src/hooks/useRepliersListings.ts` | via `repliers.ts` | |
| `src/hooks/useRepliersListing.ts` | via `repliers.ts` | |
| `src/hooks/useRepliersAutocomplete.ts` | via `repliers.ts` | |
| `src/hooks/useRepliersHealth.ts` | via `repliers.ts` | |
| `src/pages/IDXSearchBeta.tsx` | `/api/repliers/listings?...` | Beta route |
| `src/pages/IDXListingDetailBeta.tsx` | `/api/repliers/listing-detail?mlsNumber=...`, `POST /api/request-showing` | Beta route |
| `src/pages/ShowingRequests.tsx` | `GET /api/showing-requests?...` | Signed-in agent/admin view |
| `src/pages/PasswordReset.tsx` | `POST /api/send-password-changed-email` | Post-reset notification |

Every other server call in the app uses `supabase.functions.invoke(...)` (Supabase Edge Functions) and is already hosting-agnostic.

## Confirmations required before migration

Before we schedule the port, verify in production:
1. Which host answers `https://allagentconnect.com/api/repliers/health` and `https://directconnectmls.com/api/repliers/health` (Lovable = 404, Netlify = 200 JSON).
2. Whether `/showing-requests` list currently loads for a signed-in agent on both AAC and DCMLS.
3. Whether `/idx-search` returns listings on both AAC and DCMLS.
4. DNS A/CNAME target for each custom domain (`185.158.133.1` = Lovable; any other = likely Netlify).
5. Whether a Netlify site is still linked to this GitHub repo, and which domain(s) it currently serves.

The results decide whether Netlify is still live-serving traffic (and thus a migration is user-visible) or already dark (and thus migration is a cleanup exercise).

## Suggested migration order (when scheduled)

Ship one function at a time, each with the matching frontend switchover in the same change so nothing 404s. Rough order by risk:

1. `send-password-changed-email` and `send-pending-approval-email` — small surface, security scan already flagged them. Port to Supabase Edge Functions with a shared-secret header. Switch `PasswordReset.tsx` (and the pending-approval caller) from `fetch("/api/...")` to `supabase.functions.invoke("...")`.
2. `request-showing` — add auth (`REQUIRE_AUTH = true`), sanitize HTML interpolation in the email templates, then port.
3. `showing-requests` GET list — replace with a Supabase Edge Function that authenticates the caller via JWT and applies RLS; switch `ShowingRequests.tsx`.
4. Netlify edge `request-password-reset` — port to Supabase Edge Function.
5. Netlify edge `social-preview` — port to Supabase Edge Function (there is already a `social-preview` function in `supabase/functions/`; verify parity before switching `/property/*` rendering).
6. Repliers IDX proxy (6 functions) — largest surface. Requires storing the Repliers API key as a Supabase secret. Only worth doing if the IDX beta pages stay in the product; otherwise consider hiding those routes behind a feature flag and deferring.
7. ATTOM proxy — reconcile with existing Supabase `fetch-attom-market-data` / `test-attom` before porting anything new.
8. Remaining email/sync helpers (`email-worker`, `listingEmailCard`, `listingShareEmailAddress`, `aac-sync-listing`) — audit whether any are still called; delete dead ones instead of porting.

After every callsite is on `supabase.functions.invoke(...)` and no `/api/*` fetches remain in `src/`, remove `netlify.toml` and `netlify/functions/` in a single cleanup PR, then repoint any Netlify-only DNS at Lovable.

## Explicit non-goals for the current pass

- Do not delete Netlify files.
- Do not change DNS.
- Do not migrate IDX/Repliers.
- Do not alter production routing until the confirmations above are in.
- Do not treat this document as approval to start the migration — it is a checklist only.