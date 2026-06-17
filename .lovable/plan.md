## Findings

- `VITE_GOOGLE_MAPS_API_KEY` is set in the active environment.
- The buyer rental page does return rental data: `/client/search?lt=for_rent` currently shows `Results: 1` for the one rental listing that is `coming_soon`.
- The map/address issue is confirmed as configuration, not buyer-page code: Google returns `RefererNotAllowedMapError` for `https://95492335-3a75-4285-8d44-828003cae42a.lovableproject.com/client/search`.
- The database currently has only one rental eligible for default buyer search (`coming_soon`). Other rentals are `expired` or `cancelled`, so they are intentionally filtered out by the active/coming-soon search.

## Plan

1. **No code changes for Google Maps**
   - Keep the app using the existing single key path: `VITE_GOOGLE_MAPS_API_KEY`.
   - Do not add fallback connector code.
   - Fix in Google Cloud by adding this exact preview origin to the key’s HTTP referrer allowlist:
     - `https://95492335-3a75-4285-8d44-828003cae42a.lovableproject.com/*`
   - Also keep/include:
     - `https://allagentconnect.com/*`
     - `https://www.allagentconnect.com/*`
     - `https://directconnectmls.com/*`
     - `https://www.directconnectmls.com/*`
     - `https://*.lovable.app/*`
     - `https://*.lovableproject.com/*`
     - any Netlify/custom preview domains in use

2. **Verify Google API restrictions**
   - Confirm the same key allows at least:
     - Maps JavaScript API
     - Places API
     - Geocoding API if address geocoding is used by existing flows
   - Confirm billing is enabled on the Google Cloud project.

3. **Clarify rental inventory expectation**
   - Since only one rental is currently active/coming soon, no code fix is needed if seeing one rental is correct.
   - If you expected more rentals to appear, the fix is data/status-related: those listings need to be changed from `expired`/`cancelled` to a visible status, or the buyer search rules need to intentionally include those statuses.

4. **Validation after config/data updates**
   - Hard refresh `/client/search?lt=for_rent`.
   - Confirm the map no longer shows the Google Maps error.
   - Confirm address autocomplete suggestions appear.
   - Confirm the expected rental count appears based on listing status rules.