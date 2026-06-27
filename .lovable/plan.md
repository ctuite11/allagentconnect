## Restore the legacy key fallback in `googleMapsConfig.ts`

This plan reverts the single deletion from commit `1f3c1a31` that broke Maps on `allagentconnect.com`. Nothing else changes.

### Root cause (recap)
- Production custom domain was being served by `VITE_GOOGLE_MAPS_API_KEY` — that's the key whose Google Cloud referrer allowlist includes `allagentconnect.com` / `directconnectmls.com`.
- The connector var `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` holds the Lovable-managed key, which is locked to `*.lovable.app`.
- I removed the legacy fallback in `src/lib/googleMapsConfig.ts`, so the browser stopped reading the only key authorized for your domain.

### Change

**File:** `src/lib/googleMapsConfig.ts` (only file touched)

Restore the legacy fallback inside `getGoogleMapsBrowserKey()`:

```ts
export function getGoogleMapsBrowserKey(): string | undefined {
  const connectorKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  if (connectorKey) return connectorKey;

  // Legacy fallback — required while production custom domains are
  // authorized under VITE_GOOGLE_MAPS_API_KEY's referrer allowlist.
  // Do not remove until that key's domains are migrated onto the connector key.
  const legacyKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return legacyKey || undefined;
}
```

### Explicitly NOT changing
- No edits to `PropertyMap.tsx`, `AddressAutocomplete.tsx`, `BuyerMapSearch.tsx`, edge functions, `.env`, `.gitignore`, `netlify.toml`, docs, or any connector.
- No Google Cloud changes, no key rotation, no secret add/delete.
- Server-side edge functions keep using `GOOGLE_MAPS_API_KEY` as already configured.

### Verification after deploy
1. Open `allagentconnect.com/review-matches` → Map renders, no `RefererNotAllowedMapError` in console.
2. Open the Lovable preview (`*.lovable.app`) → Map still renders (connector key path still works).
3. Address autocomplete still functions on both domains.

### Follow-up (not in this plan)
Once you decide whether to keep the legacy key long-term or migrate its allowlisted domains onto the connector key, we can revisit consolidation — but only after confirming the chosen key's referrer list covers every production domain.
