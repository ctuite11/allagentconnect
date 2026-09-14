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
