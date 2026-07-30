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
  /** Legacy alias; redirects to SUCCESS_HUB. Use as Add Listing `from` when entering from Success Hub. */
  SUCCESS_HUB_RETURN: '/success-hub',
  LISTING_SEARCH: '/listing-search',
  MY_LISTINGS: '/agent/listings',
  HOT_SHEETS: '/hot-sheets',
  MY_CONTACTS: '/my-clients',
  COMMUNICATIONS: '/communications',
  PROFILE_EDITOR: '/profile',
  MARKET_INSIGHTS: '/market-insights',
  AGENT_SEARCH: '/agent-search',
  BROWSE: '/browse',
  DRAFT_LISTINGS: '/agent/listings/drafts',
  
  // Child/Detail pages (show back button)
  HOT_SHEET_REVIEW: '/hot-sheets/:id/review',
  LISTING_DETAIL: '/property/:id',
  ADD_LISTING: '/agent/listings/new',
  EDIT_LISTING: '/agent/listings/edit/:id',
  LISTING_ANALYTICS: '/agent/listings/:id/analytics',
  SEARCH_RESULTS: '/search',
  CLIENT_DETAIL: '/my-clients/:id',
  AGENT_PROFILE: '/agent/:idOrCode',
} as const;
