import { ROUTES } from './routes';

/**
 * Maps child routes to their parent routes for back navigation.
 * 
 * Pattern-based matching: Use regex patterns for dynamic routes.
 * Explicit mapping: Child route → Parent route
 */
const BACK_TARGETS: Array<{ pattern: RegExp; parent: string }> = [
  // Hot Sheets
  { pattern: /^\/hot-sheets\/[^/]+\/review$/, parent: ROUTES.HOT_SHEETS },
  { pattern: /^\/hot-sheets\/[^/]+$/, parent: ROUTES.HOT_SHEETS },
  
  // Listings
  { pattern: /^\/property\/[^/]+$/, parent: ROUTES.LISTING_SEARCH },
  { pattern: /^\/agent\/listings\/new$/, parent: ROUTES.MY_LISTINGS },
  { pattern: /^\/agent\/listings\/[^/]+\/edit$/, parent: ROUTES.MY_LISTINGS },
  { pattern: /^\/agent\/listings\/[^/]+\/analytics$/, parent: ROUTES.MY_LISTINGS },
  
  // Search Results
  { pattern: /^\/search$/, parent: ROUTES.LISTING_SEARCH },
  
  // Clients
  { pattern: /^\/my-clients\/[^/]+$/, parent: ROUTES.MY_CONTACTS },
  
  // Agent Profiles
  { pattern: /^\/agents\/[^/]+$/, parent: ROUTES.AGENT_SEARCH },
];

/**
 * Get the parent route for a given pathname.
 * Returns undefined for root pages (no back button needed).
 */
export function getBackTarget(pathname: string): string | undefined {
  for (const { pattern, parent } of BACK_TARGETS) {
    if (pattern.test(pathname)) {
      return parent;
    }
  }
  return undefined;
}
