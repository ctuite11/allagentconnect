/**
 * Shared Google Maps key resolver.
 *
 * Prefers the Lovable connector browser key (auto-provisioned by the linked
 * Google Maps connector) and falls back to a legacy manual env var for older
 * local/dev setups. Centralized so components do not invent their own lookup.
 */
export function getGoogleMapsBrowserKey(): string | undefined {
  const connectorKey = import.meta.env
    .VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const connector = (connectorKey || "").trim();
  if (connector) return connector;

  // Legacy fallback — required while production custom domains are
  // authorized under VITE_GOOGLE_MAPS_API_KEY's referrer allowlist.
  // Do not remove until that key's domains are migrated onto the connector key.
  const legacyKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
    | string
    | undefined;
  const legacy = (legacyKey || "").trim();
  return legacy || undefined;
}

export function getGoogleMapsTrackingId(): string | undefined {
  const id = import.meta.env
    .VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  return id?.trim() || undefined;
}