# Automated tests for SharedListingGate guest exception

Add focused unit tests for `src/components/SharedListingGate.tsx`, covering the signed-out guest exception that lets a shared-listing visitor open only that listing's agent profile. No production data changes, no live test requests, no app behavior changes.

## Test setup (one-time)

The project has Vitest but no DOM environment, so component tests need:

1. Add dev dependencies: `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`.
2. Add `src/test/setup.ts` (jest-dom matchers + `matchMedia` stub) and point `vitest.config.ts` at it with `environment: "jsdom"`. Keep the existing include/exclude scoping unchanged.

## Test file: `src/components/SharedListingGate.test.tsx`

Render `SharedListingGate` with mocked `useAuthRole` (signed out, not loading), mocked `useSharedListingGuest` (`isGuest: true`, fixed `allowedListingId`), a `MemoryRouter` at the route under test, and a mocked `@/integrations/supabase/client` so `from("listings_public")` and `rpc("get_public_agent_profile")` return scripted results. Assert whether the wall ("Create a free account to keep exploring") renders or children pass through.

Cases:

1. **Valid guest listing + its agent → allowed.** Route `/agent/<agent-uuid>`; `listings_public` returns that `agent_id` with a public status; children render, no wall.
2. **Valid guest listing + different agent → blocked.** `listings_public` returns a different `agent_id`; wall renders.
3. **Query-string / listing manipulation → blocked.** Route carries `?listing=<other-id>` (or similar); gate still uses only the stored `allowedListingId`, so a mismatched agent stays walled.
4. **Public-listing lookup error → blocked.** `listings_public` query returns an error; wall renders (fail closed).
5. **Lookup pending → profile not exposed.** `listings_public` promise never resolves during the assertion window; wall renders and children do not.
6. **UUID and AAC-code agent routes both resolve.** (a) `/agent/<uuid>` matches directly on `agent_id`; (b) `/agent/AAC-0639` does not match `agent_id`, falls through to `get_public_agent_profile`, and is allowed when the RPC returns the listing's `agent_id` — and blocked when it returns a different id.

Also assert the draft guard implicitly: a `listings_public` row with `status: "draft"` stays blocked (covered as part of case 2/4 family if convenient, not required).

## Verification

- Run the Vitest suite; all new tests pass and existing suites are unaffected.
- `bunx tsgo --noEmit` passes.
- No changes to `SharedListingGate.tsx` itself unless a test exposes a real bug — if one does, stop and report before changing behavior.

## Out of scope

- No production data, no real network calls (Supabase client fully mocked), no live test requests.
- No changes to guest-mode policy, routing, or any other component.
