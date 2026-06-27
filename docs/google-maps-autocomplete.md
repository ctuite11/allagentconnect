# Google Maps Address Autocomplete

Google Maps / Places is configured through the **Google Maps Platform connector**.
Linking the connector is the only setup required — Lovable provisions all keys.

## Canonical configuration

| Surface | Variable | Source |
|---|---|---|
| Browser (Maps JS, Places autocomplete) | `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | Connector (auto) |
| Browser usage tracking channel | `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` | Connector (auto) |
| Edge functions (geocoding, server calls) | `GOOGLE_MAPS_API_KEY` | Connector (auto) |

Frontend code reads the browser key through `src/lib/googleMapsConfig.ts`
(`getGoogleMapsBrowserKey()` / `getGoogleMapsTrackingId()`). No component should
read `import.meta.env.VITE_*` for Maps directly.

Edge functions read `Deno.env.get("GOOGLE_MAPS_API_KEY")`.

The legacy `VITE_GOOGLE_MAPS_API_KEY` secret is deprecated. Nothing in the
codebase reads it. It will be deleted after the connector-only deploy is
verified in production.

## Preview debug override

`src/components/PropertyMap.tsx` still accepts a one-off `?gmaps_key=` URL
parameter for ad-hoc preview debugging. It is not used in production.

## Google Cloud requirements

Managed by the connector. APIs (Maps JavaScript, Places New, Geocoding) and
HTTP referrer restrictions for `allagentconnect.com`, `directconnectmls.com`,
and `*.lovable.app` are configured on the connector's key.

## Troubleshooting

| Error | Meaning | Fix |
|---|---|---|
| `RefererNotAllowedMapError` | Domain not on the key's referrer allowlist | Update the connector key's referrers in Google Cloud |
| `ApiNotActivatedMapError` | Required Maps API not enabled | Enable on the connector key's Cloud project |
| `InvalidKeyMapError` | Key rotated/disabled | Reconnect the Google Maps Platform connector |
| `Autocomplete disabled (missing key)` | `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` not injected | Confirm the connector is linked and republish |

## Security

Browser Maps keys are public by design and secured via referrer restrictions.
The server key (`GOOGLE_MAPS_API_KEY`) is never exposed to the client.