/**
 * Route constants for AAC navigation
 * 
 * Root pages: No back button (sidebar destinations)
 * Child pages: Show back button to parent
 */

export const ROUTES = {
  // Root pages (no back button)
  HOME: '/',
  SUCCESS_HUB: '/agent-dashboard',
  LISTING_SEARCH: '/listing-search',
  MY_LISTINGS: '/agent/listings',
  HOT_SHEETS: '/hot-sheets',
  MY_CONTACTS: '/my-clients',
  COMMUNICATIONS: '/communications',
  PROFILE_EDITOR: '/profile',
  MARKET_INSIGHTS: '/market-insights',
  AGENT_SEARCH: '/agent-search',
  BROWSE: '/browse',
  
  // Child/Detail pages (show back button)
  HOT_SHEET_REVIEW: '/hot-sheets/:id/review',
  LISTING_DETAIL: '/property/:id',
  ADD_LISTING: '/agent/listings/new',
  EDIT_LISTING: '/agent/listings/:id/edit',
  LISTING_ANALYTICS: '/agent/listings/:id/analytics',
  SEARCH_RESULTS: '/search',
  CLIENT_DETAIL: '/my-clients/:id',
  AGENT_PROFILE: '/agents/:id',
} as const;
