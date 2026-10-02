/**
 * Centralized frontend feature flags.
 *
 * CONCIERGE_LISTINGS_ENABLED
 * Temporarily disables the concierge-listing frontend (admin concierge pages and
 * the member review/publish route) so unrelated fixes can ship without exposing
 * the untested concierge workflow. All concierge code remains in place; flip this
 * to `true` to re-enable it after the review-email test passes.
 */
export const CONCIERGE_LISTINGS_ENABLED = false;

/**
 * SOCIAL_PUBLISHING_UI_ENABLED
 * Hides every agent-facing social publishing surface (publish-dialog social
 * section, post-publish prompt, Settings card) while the feature is on hold.
 * Backend tables, edge functions, Bundle integration, and the server-side
 * launch gate stay fully intact; flip to `true` to restore the UI.
 */
export const SOCIAL_PUBLISHING_UI_ENABLED = false;
