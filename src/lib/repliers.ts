/**
 * Repliers IDX API Client
 * 
 * All requests go through our Netlify Functions proxy.
 * NEVER call api.repliers.io directly from the frontend.
 */

// Allowed query parameters for listings search
const ALLOWED_LISTING_PARAMS = new Set([
  "city",
  "neighborhood",
  "area",
  "minPrice",
  "maxPrice",
  "minBeds",
  "maxBeds",
  "minBaths",
  "maxBaths",
  "propertyType",
  "status",
  "pageNum",
  "resultsPerPage",
  "sortBy",
  "sortOrder",
  "class",
  "type",
  "lastStatus",
]);

export interface RepliersListingsParams {
  city?: string;
  neighborhood?: string;
  area?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  propertyType?: string;
  status?: string;
  pageNum?: number;
  resultsPerPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  class?: string;
  type?: string;
  lastStatus?: string;
}

export interface RepliersListing {
  mlsNumber?: string;
  listPrice?: number;
  address?: {
    streetNumber?: string;
    streetName?: string;
    streetSuffix?: string;
    city?: string;
    state?: string;
    zip?: string;
    neighborhood?: string;
  };
  details?: {
    numBedrooms?: number;
    numBathrooms?: number;
    sqft?: number;
    lotSize?: number;
    yearBuilt?: number;
    propertyType?: string;
  };
  photos?: string[];
  description?: string;
  listingAgent?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  [key: string]: unknown;
}

export interface RepliersListingsResponse {
  listings?: RepliersListing[];
  count?: number;
  page?: number;
  numPages?: number;
  [key: string]: unknown;
}

export interface RepliersHealthResponse {
  ok: boolean;
  envConfigured?: boolean;
  upstreamHealthy?: boolean;
  authHeader?: string;
  error?: string;
  timestamp?: string;
}

export interface RepliersAutocompleteResponse {
  suggestions?: Array<{
    text?: string;
    type?: string;
    [key: string]: unknown;
  }>;
  note?: string;
  [key: string]: unknown;
}

export class RepliersApiError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = "RepliersApiError";
    this.status = status;
  }
}

/**
 * Build query string from params, filtering to allowed params only
 */
function buildQueryString(params: RepliersListingsParams): string {
  const filtered = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    if (ALLOWED_LISTING_PARAMS.has(key) && value !== undefined && value !== null && value !== "") {
      filtered.set(key, String(value));
    }
  }
  
  return filtered.toString();
}

/**
 * Handle API response and throw appropriate errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json();
  }
  
  let errorMessage = "Request failed";
  try {
    const errorData = await response.json();
    errorMessage = errorData.error || errorMessage;
  } catch {
    // Ignore JSON parse errors
  }
  
  throw new RepliersApiError(errorMessage, response.status);
}

/**
 * Search listings via proxy
 * Cached server-side for ~60 seconds
 */
export async function searchListings(
  params: RepliersListingsParams = {}
): Promise<RepliersListingsResponse> {
  const queryString = buildQueryString(params);
  const url = `/api/repliers/listings${queryString ? `?${queryString}` : ""}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  
  return handleResponse<RepliersListingsResponse>(response);
}

/**
 * Get single listing details via proxy
 * Cached server-side for ~120 seconds
 */
export async function getListingDetail(
  listingId: string
): Promise<RepliersListing> {
  if (!listingId || !/^[\w-]+$/.test(listingId)) {
    throw new RepliersApiError("Invalid listing ID", 400);
  }
  
  const url = `/api/repliers/listing/${encodeURIComponent(listingId)}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  
  return handleResponse<RepliersListing>(response);
}

/**
 * Autocomplete for locations/addresses via proxy
 * Minimum 2 characters required
 * Cached server-side for ~300 seconds
 */
export async function autocomplete(
  query: string
): Promise<RepliersAutocompleteResponse> {
  if (!query || query.length < 2) {
    return { suggestions: [] };
  }
  
  const url = `/api/repliers/autocomplete?q=${encodeURIComponent(query)}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  
  return handleResponse<RepliersAutocompleteResponse>(response);
}

/**
 * Health check for debugging/validation
 * Returns { ok: true } when proxy + upstream are working
 */
export async function checkHealth(): Promise<RepliersHealthResponse> {
  const response = await fetch("/api/repliers/health", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  
  return handleResponse<RepliersHealthResponse>(response);
}
