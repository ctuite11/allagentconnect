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

/**
 * DCMLS_SETTINGS_UI_ENABLED
 * Hides all agent-facing DCMLS surfaces together: Profile/Settings,
 * listing publishing controls and introductions, badges/search controls,
 * and the Requests navigation/routes until Direct Connect MLS is ready. All DCMLS backend
 * fields, participation state, audit history, saved preferences, and code stay
 * fully intact; flip to `true` to restore the UI.
 */
export const DCMLS_SETTINGS_UI_ENABLED = false;

/**
 * DEVELOPER_ACCESS_UI_ENABLED
 * Temporarily hides the public Developer request/sign-in paths and blocks the
 * private Developer workspace until the product is ready. Developer accounts,
 * memberships, projects, backend data, and implementation remain intact; flip
 * to `true` to restore every Developer access surface together.
 */
export const DEVELOPER_ACCESS_UI_ENABLED = false;
