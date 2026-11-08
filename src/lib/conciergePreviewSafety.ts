/**
 * Public Netlify deploy previews can be connected to production Supabase.
 * Form testing on those hosts must never save a Concierge request, upload
 * private photos or queue staff notifications — regardless of the user role.
 *
 * A separate approved staging site is required for real end-to-end tests.
 */
export function isConciergeNoSendPreviewHost(hostname: string): boolean {
  return /^deploy-preview-[0-9]+--[a-z0-9-]+\.netlify\.app$/i.test(hostname.trim());
}
