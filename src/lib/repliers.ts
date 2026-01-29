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

export interface RepliersAgent {
  name?: string;
  email?: string;
  phones?: string[];
  website?: string;
  photo?: { small?: string; large?: string };
  brokerage?: { name?: string; address?: string };
  // Role fields vary by MLS feed
  role?: string;
  roles?: string[];
  type?: string;
  agentType?: string;
}

export interface RepliersOffice {
  brokerageName?: string;
  name?: string;
  phone?: string;
  address?: string;
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
  agents?: RepliersAgent[];
  office?: RepliersOffice;
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
  // Guard against HTML responses (SPA fallback or routing miss)
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new RepliersApiError(
      `Expected JSON, got ${contentType}. First 120 chars: ${text.slice(0, 120)}`,
      response.status
    );
  }

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

/**
 * Pick the listing agent from the agents array.
 * MLS feeds vary in how they mark agent roles.
 * 
 * Selection logic:
 * 1. If any agent has a role/type containing "list", "listing", or "seller" → pick that one
 * 2. Otherwise → pick agents[0] as primary
 * 3. If no agents → return null
 */
export function pickListingAgent(agents: RepliersAgent[] = []): RepliersAgent | null {
  const isListingRole = (agent: RepliersAgent): boolean => {
    const roleText = [
      agent.role,
      agent.type,
      agent.agentType,
      ...(agent.roles ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return roleText.includes("list") || roleText.includes("seller") || roleText.includes("listing");
  };

  return agents.find(isListingRole) ?? agents[0] ?? null;
}

/**
 * Get display-ready agent info from a listing.
 * Returns structured data for UI rendering with fallbacks.
 */
export function getListingAgentDisplay(listing: RepliersListing): {
  agentName: string | null;
  agentPhone: string | null;
  agentEmail: string | null;
  agentPhoto: string | null;
  agentWebsite: string | null;
  brokerageName: string | null;
  hasPrimaryContact: boolean;
} {
  const agent = pickListingAgent(listing.agents);
  
  const agentName = agent?.name || null;
  const agentPhone = agent?.phones?.[0] || null;
  const agentEmail = agent?.email || null;
  const agentPhoto = agent?.photo?.small || null;
  const agentWebsite = agent?.website || null;
  const brokerageName = agent?.brokerage?.name || listing.office?.brokerageName || null;
  
  // Has primary contact if we have either email or phone
  const hasPrimaryContact = !!(agentEmail || agentPhone);
  
  return {
    agentName,
    agentPhone,
    agentEmail,
    agentPhoto,
    agentWebsite,
    brokerageName,
    hasPrimaryContact,
  };
}
