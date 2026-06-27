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
  const key = (connectorKey || "").trim();
  return key || undefined;
}

export function getGoogleMapsTrackingId(): string | undefined {
  const id = import.meta.env
    .VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  return id?.trim() || undefined;
}