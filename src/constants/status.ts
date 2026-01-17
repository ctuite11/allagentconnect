/**
 * STATUS SYSTEM — SINGLE SOURCE OF TRUTH
 *
 * Do not hardcode status labels, colors, or comparisons anywhere in the UI.
 *
 * ✅ UI MUST use:
 *  - ListingStatusBadge / AgentStatusBadge / HotSheetStatusBadge (or StatusBadge variants)
 *  - exported option arrays from this file for selects/tabs/filters
 *  - exported constants (e.g., LISTING_STATUS.*, AGENT_STATUS.*, HOT_SHEET_STATUS.*) for any mapping
 *
 * ❌ UI MUST NOT use:
 *  - raw <Badge> to render domain statuses
 *  - inline labels like "Active", "Pending", "Coming Soon"
 *  - string comparisons like status === "coming_soon"
 *  - formatting like status.replace(/_/g, " ")
 *
 * If you need a new status, add it here and update the badge + option sets.
 */

// =============================================================================
// AGENT STATUS
// =============================================================================

export const AGENT_STATUS = {
  UNVERIFIED: "unverified",
  PENDING: "pending",
  VERIFIED: "verified",
  RESTRICTED: "restricted",
  REJECTED: "rejected",
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  [AGENT_STATUS.UNVERIFIED]: "Unverified",
  [AGENT_STATUS.PENDING]: "Pending",
  [AGENT_STATUS.VERIFIED]: "Verified",
  [AGENT_STATUS.RESTRICTED]: "Restricted",
  [AGENT_STATUS.REJECTED]: "Rejected",
};

export const AGENT_STATUS_CONFIG: Record<AgentStatus, { bg: string; text: string; label: string }> = {
  [AGENT_STATUS.UNVERIFIED]: { bg: "bg-neutral-100", text: "text-neutral-600", label: "Unverified" },
  [AGENT_STATUS.PENDING]: { bg: "bg-amber-50", text: "text-amber-700", label: "Pending" },
  [AGENT_STATUS.VERIFIED]: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Verified" },
  [AGENT_STATUS.RESTRICTED]: { bg: "bg-rose-50", text: "text-rose-700", label: "Restricted" },
  [AGENT_STATUS.REJECTED]: { bg: "bg-rose-50", text: "text-rose-700", label: "Rejected" },
};

// =============================================================================
// LISTING STATUS
// =============================================================================

export const LISTING_STATUS = {
  ACTIVE: "active",
  NEW: "new",
  COMING_SOON: "coming_soon",
  BACK_ON_MARKET: "back_on_market",
  PRICE_CHANGED: "price_changed",
  EXTENDED: "extended",
  REACTIVATED: "reactivated",
  UNDER_AGREEMENT: "under_agreement",
  PENDING: "pending",
  CONTINGENT: "contingent",
  SOLD: "sold",
  RENTED: "rented",
  WITHDRAWN: "withdrawn",
  TEMPORARILY_WITHDRAWN: "temporarily_withdrawn",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  CANCELED: "canceled", // alias for backwards compatibility
  DRAFT: "draft",
  OFF_MARKET: "off_market",
} as const;

export type ListingStatus = (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS];

export const LISTING_STATUS_LABELS: Record<string, string> = {
  [LISTING_STATUS.ACTIVE]: "Active",
  [LISTING_STATUS.NEW]: "New",
  [LISTING_STATUS.COMING_SOON]: "Coming Soon",
  [LISTING_STATUS.BACK_ON_MARKET]: "Back on Market",
  [LISTING_STATUS.PRICE_CHANGED]: "Price Change",
  [LISTING_STATUS.EXTENDED]: "Extended",
  [LISTING_STATUS.REACTIVATED]: "Reactivated",
  [LISTING_STATUS.UNDER_AGREEMENT]: "Under Agreement",
  [LISTING_STATUS.PENDING]: "Pending",
  [LISTING_STATUS.CONTINGENT]: "Contingent",
  [LISTING_STATUS.SOLD]: "Sold",
  [LISTING_STATUS.RENTED]: "Rented",
  [LISTING_STATUS.WITHDRAWN]: "Withdrawn",
  [LISTING_STATUS.TEMPORARILY_WITHDRAWN]: "Temporarily Withdrawn",
  [LISTING_STATUS.EXPIRED]: "Expired",
  [LISTING_STATUS.CANCELLED]: "Cancelled",
  [LISTING_STATUS.CANCELED]: "Canceled",
  [LISTING_STATUS.DRAFT]: "Draft",
  [LISTING_STATUS.OFF_MARKET]: "Off-Market",
};

// MLSPIN code mappings for Hot Sheet dialog
export const LISTING_STATUS_MLSPIN: Record<string, string> = {
  [LISTING_STATUS.ACTIVE]: "ACT",
  [LISTING_STATUS.NEW]: "NEW",
  [LISTING_STATUS.COMING_SOON]: "CSO",
  [LISTING_STATUS.BACK_ON_MARKET]: "BOM",
  [LISTING_STATUS.PRICE_CHANGED]: "PCH",
  [LISTING_STATUS.EXTENDED]: "EXT",
  [LISTING_STATUS.REACTIVATED]: "REA",
  [LISTING_STATUS.UNDER_AGREEMENT]: "UAG",
  [LISTING_STATUS.PENDING]: "PND",
  [LISTING_STATUS.CONTINGENT]: "CTG",
  [LISTING_STATUS.SOLD]: "SLD",
  [LISTING_STATUS.RENTED]: "RNT",
  [LISTING_STATUS.WITHDRAWN]: "WDN",
  [LISTING_STATUS.TEMPORARILY_WITHDRAWN]: "WDN",
  [LISTING_STATUS.EXPIRED]: "EXP",
  [LISTING_STATUS.CANCELLED]: "CAN",
  [LISTING_STATUS.CANCELED]: "CAN",
  [LISTING_STATUS.DRAFT]: "DFT",
  [LISTING_STATUS.OFF_MARKET]: "OFF",
};

export const LISTING_STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  [LISTING_STATUS.ACTIVE]: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
  [LISTING_STATUS.NEW]: { bg: "bg-emerald-50", text: "text-emerald-700", label: "New" },
  [LISTING_STATUS.COMING_SOON]: { bg: "bg-amber-50", text: "text-amber-700", label: "Coming Soon" },
  [LISTING_STATUS.BACK_ON_MARKET]: { bg: "bg-orange-50", text: "text-orange-700", label: "Back on Market" },
  [LISTING_STATUS.PRICE_CHANGED]: { bg: "bg-blue-50", text: "text-blue-700", label: "Price Change" },
  [LISTING_STATUS.EXTENDED]: { bg: "bg-blue-50", text: "text-blue-700", label: "Extended" },
  [LISTING_STATUS.REACTIVATED]: { bg: "bg-teal-50", text: "text-teal-700", label: "Reactivated" },
  [LISTING_STATUS.UNDER_AGREEMENT]: { bg: "bg-violet-50", text: "text-violet-700", label: "Under Agreement" },
  [LISTING_STATUS.PENDING]: { bg: "bg-violet-50", text: "text-violet-700", label: "Pending" },
  [LISTING_STATUS.CONTINGENT]: { bg: "bg-violet-50", text: "text-violet-700", label: "Contingent" },
  [LISTING_STATUS.SOLD]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Sold" },
  [LISTING_STATUS.RENTED]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Rented" },
  [LISTING_STATUS.WITHDRAWN]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Withdrawn" },
  [LISTING_STATUS.TEMPORARILY_WITHDRAWN]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Temporarily Withdrawn" },
  [LISTING_STATUS.EXPIRED]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Expired" },
  [LISTING_STATUS.CANCELLED]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Cancelled" },
  [LISTING_STATUS.CANCELED]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Canceled" },
  [LISTING_STATUS.DRAFT]: { bg: "bg-neutral-100", text: "text-neutral-600", label: "Draft" },
  [LISTING_STATUS.OFF_MARKET]: { bg: "bg-rose-50", text: "text-rose-700", label: "Off-Market" },
};

// Statuses considered "off market" for banner logic
export const OFF_MARKET_STATUSES: ListingStatus[] = [
  LISTING_STATUS.PENDING,
  LISTING_STATUS.UNDER_AGREEMENT,
  LISTING_STATUS.WITHDRAWN,
  LISTING_STATUS.CANCELLED,
  LISTING_STATUS.TEMPORARILY_WITHDRAWN,
];

// Statuses shown in agent dashboard filter
export const DASHBOARD_FILTER_STATUSES: ListingStatus[] = [
  LISTING_STATUS.ACTIVE,
  LISTING_STATUS.DRAFT,
  LISTING_STATUS.COMING_SOON,
  LISTING_STATUS.NEW,
  LISTING_STATUS.BACK_ON_MARKET,
  LISTING_STATUS.EXPIRED,
  LISTING_STATUS.PENDING,
  LISTING_STATUS.CANCELLED,
  LISTING_STATUS.TEMPORARILY_WITHDRAWN,
  LISTING_STATUS.SOLD,
];

// =============================================================================
// HOT SHEET STATUS (currently boolean, this is for future migration)
// =============================================================================

export const HOT_SHEET_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  ARCHIVED: "archived",
} as const;

export type HotSheetStatus = (typeof HOT_SHEET_STATUS)[keyof typeof HOT_SHEET_STATUS];

export const HOT_SHEET_STATUS_LABELS: Record<HotSheetStatus, string> = {
  [HOT_SHEET_STATUS.ACTIVE]: "Active",
  [HOT_SHEET_STATUS.PAUSED]: "Paused",
  [HOT_SHEET_STATUS.ARCHIVED]: "Archived",
};

export const HOT_SHEET_STATUS_CONFIG: Record<HotSheetStatus, { bg: string; text: string; label: string }> = {
  [HOT_SHEET_STATUS.ACTIVE]: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
  [HOT_SHEET_STATUS.PAUSED]: { bg: "bg-amber-50", text: "text-amber-700", label: "Paused" },
  [HOT_SHEET_STATUS.ARCHIVED]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Archived" },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get status configuration for any status type
 */
export function getStatusConfig(status: string, domain: "listing" | "agent" | "hotsheet" = "listing") {
  const fallback = { bg: "bg-neutral-100", text: "text-neutral-600", label: status };
  
  switch (domain) {
    case "agent":
      return AGENT_STATUS_CONFIG[status as AgentStatus] || fallback;
    case "hotsheet":
      return HOT_SHEET_STATUS_CONFIG[status as HotSheetStatus] || fallback;
    case "listing":
    default:
      return LISTING_STATUS_CONFIG[status as ListingStatus] || fallback;
  }
}

/**
 * Check if a listing status is considered "off market"
 */
export function isOffMarketStatus(status: string): boolean {
  return OFF_MARKET_STATUSES.includes(status as ListingStatus);
}

/**
 * Normalize legacy status values
 * Maps old/variant spellings to canonical values
 */
export function normalizeStatus(status: string): string {
  const normalizations: Record<string, string> = {
    // Spelling variants
    "canceled": LISTING_STATUS.CANCELLED,
    "temp_withdrawn": LISTING_STATUS.TEMPORARILY_WITHDRAWN,
    "under_contract": LISTING_STATUS.UNDER_AGREEMENT,
    // Legacy agent terms (should not appear but just in case)
    "approved": AGENT_STATUS.VERIFIED,
  };
  
  return normalizations[status?.toLowerCase()] || status;
}

// =============================================================================
// PROPERTY TYPES (shared across filter panels)
// =============================================================================

export const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "multi_family", label: "Multi-Family" },
  { value: "townhouse", label: "Townhouse" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
  { value: "residential_rental", label: "Residential Rental" },
];

// =============================================================================
// FILTER OPTION ARRAYS (for dropdowns)
// =============================================================================

/**
 * Statuses for MLSPIN filter panel
 */
export const MLSPIN_FILTER_STATUSES = [
  { value: LISTING_STATUS.ACTIVE, label: LISTING_STATUS_LABELS[LISTING_STATUS.ACTIVE] },
  { value: LISTING_STATUS.COMING_SOON, label: LISTING_STATUS_LABELS[LISTING_STATUS.COMING_SOON] },
  { value: LISTING_STATUS.OFF_MARKET, label: "Off-Market (Private)" },
  { value: LISTING_STATUS.PENDING, label: LISTING_STATUS_LABELS[LISTING_STATUS.PENDING] },
  { value: LISTING_STATUS.SOLD, label: LISTING_STATUS_LABELS[LISTING_STATUS.SOLD] },
];

/**
 * Complete statuses for listing search filters
 */
export const LISTING_SEARCH_STATUSES = [
  { value: LISTING_STATUS.NEW, label: LISTING_STATUS_LABELS[LISTING_STATUS.NEW] },
  { value: LISTING_STATUS.ACTIVE, label: LISTING_STATUS_LABELS[LISTING_STATUS.ACTIVE] },
  { value: LISTING_STATUS.PRICE_CHANGED, label: LISTING_STATUS_LABELS[LISTING_STATUS.PRICE_CHANGED] },
  { value: LISTING_STATUS.BACK_ON_MARKET, label: LISTING_STATUS_LABELS[LISTING_STATUS.BACK_ON_MARKET] },
  { value: LISTING_STATUS.EXTENDED, label: LISTING_STATUS_LABELS[LISTING_STATUS.EXTENDED] },
  { value: LISTING_STATUS.REACTIVATED, label: LISTING_STATUS_LABELS[LISTING_STATUS.REACTIVATED] },
  { value: LISTING_STATUS.COMING_SOON, label: LISTING_STATUS_LABELS[LISTING_STATUS.COMING_SOON] },
  { value: LISTING_STATUS.OFF_MARKET, label: "Private" },
  { value: LISTING_STATUS.UNDER_AGREEMENT, label: LISTING_STATUS_LABELS[LISTING_STATUS.UNDER_AGREEMENT] },
  { value: LISTING_STATUS.PENDING, label: LISTING_STATUS_LABELS[LISTING_STATUS.PENDING] },
  { value: LISTING_STATUS.CONTINGENT, label: LISTING_STATUS_LABELS[LISTING_STATUS.CONTINGENT] },
  { value: LISTING_STATUS.TEMPORARILY_WITHDRAWN, label: LISTING_STATUS_LABELS[LISTING_STATUS.TEMPORARILY_WITHDRAWN] },
  { value: LISTING_STATUS.WITHDRAWN, label: LISTING_STATUS_LABELS[LISTING_STATUS.WITHDRAWN] },
  { value: LISTING_STATUS.EXPIRED, label: LISTING_STATUS_LABELS[LISTING_STATUS.EXPIRED] },
  { value: LISTING_STATUS.CANCELLED, label: LISTING_STATUS_LABELS[LISTING_STATUS.CANCELLED] },
  { value: LISTING_STATUS.SOLD, label: LISTING_STATUS_LABELS[LISTING_STATUS.SOLD] },
  { value: LISTING_STATUS.RENTED, label: LISTING_STATUS_LABELS[LISTING_STATUS.RENTED] },
];

/**
 * Agent status options for admin approvals
 */
export const AGENT_STATUS_OPTIONS = [
  { value: AGENT_STATUS.UNVERIFIED, label: AGENT_STATUS_LABELS[AGENT_STATUS.UNVERIFIED] },
  { value: AGENT_STATUS.PENDING, label: AGENT_STATUS_LABELS[AGENT_STATUS.PENDING] },
  { value: AGENT_STATUS.VERIFIED, label: AGENT_STATUS_LABELS[AGENT_STATUS.VERIFIED] },
  { value: AGENT_STATUS.REJECTED, label: AGENT_STATUS_LABELS[AGENT_STATUS.REJECTED] },
  { value: AGENT_STATUS.RESTRICTED, label: AGENT_STATUS_LABELS[AGENT_STATUS.RESTRICTED] },
];

/**
 * Hot Sheet status options with MLSPIN codes
 */
export const HOT_SHEET_FILTER_STATUSES = [
  { value: LISTING_STATUS.NEW, label: `New (${LISTING_STATUS_MLSPIN[LISTING_STATUS.NEW]})` },
  { value: LISTING_STATUS.ACTIVE, label: `Active (${LISTING_STATUS_MLSPIN[LISTING_STATUS.ACTIVE]})` },
  { value: LISTING_STATUS.PRICE_CHANGED, label: `Price Changed (${LISTING_STATUS_MLSPIN[LISTING_STATUS.PRICE_CHANGED]})` },
  { value: LISTING_STATUS.BACK_ON_MARKET, label: `Back on Market (${LISTING_STATUS_MLSPIN[LISTING_STATUS.BACK_ON_MARKET]})` },
  { value: LISTING_STATUS.EXTENDED, label: `Extended (${LISTING_STATUS_MLSPIN[LISTING_STATUS.EXTENDED]})` },
  { value: LISTING_STATUS.REACTIVATED, label: `Reactivated (${LISTING_STATUS_MLSPIN[LISTING_STATUS.REACTIVATED]})` },
  { value: LISTING_STATUS.CONTINGENT, label: `Contingent (${LISTING_STATUS_MLSPIN[LISTING_STATUS.CONTINGENT]})` },
  { value: LISTING_STATUS.UNDER_AGREEMENT, label: `Under Agreement (${LISTING_STATUS_MLSPIN[LISTING_STATUS.UNDER_AGREEMENT]})` },
  { value: LISTING_STATUS.SOLD, label: `Sold (${LISTING_STATUS_MLSPIN[LISTING_STATUS.SOLD]})` },
  { value: LISTING_STATUS.RENTED, label: `Rented (${LISTING_STATUS_MLSPIN[LISTING_STATUS.RENTED]})` },
  { value: LISTING_STATUS.TEMPORARILY_WITHDRAWN, label: `Temporarily Withdrawn (${LISTING_STATUS_MLSPIN[LISTING_STATUS.TEMPORARILY_WITHDRAWN]})` },
  { value: LISTING_STATUS.EXPIRED, label: `Expired (${LISTING_STATUS_MLSPIN[LISTING_STATUS.EXPIRED]})` },
  { value: LISTING_STATUS.CANCELED, label: `Canceled (${LISTING_STATUS_MLSPIN[LISTING_STATUS.CANCELED]})` },
  { value: LISTING_STATUS.COMING_SOON, label: `Coming Soon (${LISTING_STATUS_MLSPIN[LISTING_STATUS.COMING_SOON]})` },
];

/**
 * Agent search filter statuses
 */
export const AGENT_SEARCH_STATUSES = [
  { value: LISTING_STATUS.NEW, label: LISTING_STATUS_LABELS[LISTING_STATUS.NEW] },
  { value: LISTING_STATUS.COMING_SOON, label: LISTING_STATUS_LABELS[LISTING_STATUS.COMING_SOON] },
  { value: LISTING_STATUS.ACTIVE, label: LISTING_STATUS_LABELS[LISTING_STATUS.ACTIVE] },
  { value: LISTING_STATUS.BACK_ON_MARKET, label: LISTING_STATUS_LABELS[LISTING_STATUS.BACK_ON_MARKET] },
  { value: LISTING_STATUS.CONTINGENT, label: LISTING_STATUS_LABELS[LISTING_STATUS.CONTINGENT] },
  { value: LISTING_STATUS.UNDER_AGREEMENT, label: LISTING_STATUS_LABELS[LISTING_STATUS.UNDER_AGREEMENT] },
  { value: LISTING_STATUS.SOLD, label: LISTING_STATUS_LABELS[LISTING_STATUS.SOLD] },
  { value: LISTING_STATUS.EXPIRED, label: LISTING_STATUS_LABELS[LISTING_STATUS.EXPIRED] },
  { value: LISTING_STATUS.EXTENDED, label: LISTING_STATUS_LABELS[LISTING_STATUS.EXTENDED] },
  { value: LISTING_STATUS.PRICE_CHANGED, label: LISTING_STATUS_LABELS[LISTING_STATUS.PRICE_CHANGED] },
  { value: LISTING_STATUS.TEMPORARILY_WITHDRAWN, label: LISTING_STATUS_LABELS[LISTING_STATUS.TEMPORARILY_WITHDRAWN] },
  { value: LISTING_STATUS.CANCELED, label: LISTING_STATUS_LABELS[LISTING_STATUS.CANCELED] },
];

/**
 * Consumer search filter statuses (simplified)
 */
export const CONSUMER_SEARCH_STATUSES = [
  { value: LISTING_STATUS.NEW, label: LISTING_STATUS_LABELS[LISTING_STATUS.NEW] },
  { value: LISTING_STATUS.ACTIVE, label: LISTING_STATUS_LABELS[LISTING_STATUS.ACTIVE] },
  { value: LISTING_STATUS.COMING_SOON, label: LISTING_STATUS_LABELS[LISTING_STATUS.COMING_SOON] },
  { value: LISTING_STATUS.BACK_ON_MARKET, label: LISTING_STATUS_LABELS[LISTING_STATUS.BACK_ON_MARKET] },
  { value: LISTING_STATUS.PRICE_CHANGED, label: LISTING_STATUS_LABELS[LISTING_STATUS.PRICE_CHANGED] },
];

/**
 * Default statuses for search
 */
export const DEFAULT_SEARCH_STATUSES = [
  LISTING_STATUS.NEW,
  LISTING_STATUS.COMING_SOON,
  LISTING_STATUS.ACTIVE,
  LISTING_STATUS.BACK_ON_MARKET,
];

/**
 * Rental listing statuses
 */
export const RENTAL_STATUS_OPTIONS = [
  { value: LISTING_STATUS.ACTIVE, label: "Available" },
  { value: LISTING_STATUS.PENDING, label: "Pending" },
  { value: LISTING_STATUS.RENTED, label: "Rented" },
];

/**
 * Agent listings page tab statuses
 */
export const AGENT_LISTINGS_TAB_STATUSES = [
  { value: "on_market", label: "On Market" },
  { value: "under_agreement", label: "Under Agreement" },
  { value: "sold_rented", label: "Sold / Rented" },
  { value: LISTING_STATUS.WITHDRAWN, label: LISTING_STATUS_LABELS[LISTING_STATUS.WITHDRAWN] },
  { value: LISTING_STATUS.EXPIRED, label: LISTING_STATUS_LABELS[LISTING_STATUS.EXPIRED] },
  { value: LISTING_STATUS.CANCELED, label: LISTING_STATUS_LABELS[LISTING_STATUS.CANCELED] },
  { value: "offline_partial", label: "Offline / Partial" },
];

/**
 * Add Listing form - CREATE mode statuses
 */
export const ADD_LISTING_CREATE_STATUSES = [
  { value: LISTING_STATUS.OFF_MARKET, label: "Off-Market (Private)" },
  { value: LISTING_STATUS.COMING_SOON, label: LISTING_STATUS_LABELS[LISTING_STATUS.COMING_SOON] },
  { value: LISTING_STATUS.NEW, label: "New (Active)" },
];

/**
 * Add Listing form - EDIT mode statuses
 */
export const ADD_LISTING_EDIT_STATUSES = [
  { value: LISTING_STATUS.OFF_MARKET, label: "Off-Market (Private)" },
  { value: LISTING_STATUS.COMING_SOON, label: LISTING_STATUS_LABELS[LISTING_STATUS.COMING_SOON] },
  { value: LISTING_STATUS.NEW, label: LISTING_STATUS_LABELS[LISTING_STATUS.NEW] },
  { value: LISTING_STATUS.ACTIVE, label: LISTING_STATUS_LABELS[LISTING_STATUS.ACTIVE] },
  { value: LISTING_STATUS.PENDING, label: LISTING_STATUS_LABELS[LISTING_STATUS.PENDING] },
  { value: LISTING_STATUS.WITHDRAWN, label: LISTING_STATUS_LABELS[LISTING_STATUS.WITHDRAWN] },
  { value: LISTING_STATUS.TEMPORARILY_WITHDRAWN, label: LISTING_STATUS_LABELS[LISTING_STATUS.TEMPORARILY_WITHDRAWN] },
  { value: LISTING_STATUS.EXPIRED, label: LISTING_STATUS_LABELS[LISTING_STATUS.EXPIRED] },
  { value: LISTING_STATUS.CANCELLED, label: LISTING_STATUS_LABELS[LISTING_STATUS.CANCELLED] },
  { value: LISTING_STATUS.SOLD, label: LISTING_STATUS_LABELS[LISTING_STATUS.SOLD] },
];

/**
 * Get status color class for diagnostic displays
 */
export function getDiagnosticStatusColor(status: string): string {
  switch (status) {
    case AGENT_STATUS.VERIFIED:
      return "text-emerald-600";
    case AGENT_STATUS.PENDING:
      return "text-amber-600";
    case AGENT_STATUS.REJECTED:
    case AGENT_STATUS.RESTRICTED:
      return "text-red-600";
    default:
      return "text-zinc-700";
  }
};

// =============================================================================
// TYPE GUARDS
// =============================================================================

const LISTING_STATUS_VALUES = Object.values(LISTING_STATUS) as string[];
const AGENT_STATUS_VALUES = Object.values(AGENT_STATUS) as string[];
const HOT_SHEET_STATUS_VALUES = Object.values(HOT_SHEET_STATUS) as string[];

/**
 * Type guard: is this a valid ListingStatus?
 */
export function isListingStatus(status: unknown): status is ListingStatus {
  return typeof status === "string" && LISTING_STATUS_VALUES.includes(status);
}

/**
 * Type guard: is this a valid AgentStatus?
 */
export function isAgentStatus(status: unknown): status is AgentStatus {
  return typeof status === "string" && AGENT_STATUS_VALUES.includes(status);
}

/**
 * Type guard: is this a valid HotSheetStatus?
 */
export function isHotSheetStatus(status: unknown): status is HotSheetStatus {
  return typeof status === "string" && HOT_SHEET_STATUS_VALUES.includes(status);
}

// =============================================================================
// STATUS HELPERS — LISTING
// =============================================================================

/**
 * Check if a listing status is "coming soon"
 */
export function isComingSoon(status: string): boolean {
  return status === LISTING_STATUS.COMING_SOON;
}

/**
 * Check if a listing status is actively on-market (ACTIVE, NEW, BACK_ON_MARKET, REACTIVATED)
 */
export function isListingOnMarket(status: string): boolean {
  return (
    status === LISTING_STATUS.ACTIVE ||
    status === LISTING_STATUS.NEW ||
    status === LISTING_STATUS.BACK_ON_MARKET ||
    status === LISTING_STATUS.REACTIVATED
  );
}

/**
 * Check if a status is "active" or "new" (legacy helper, prefer isListingOnMarket)
 */
export function isActive(status: string): boolean {
  return status === LISTING_STATUS.ACTIVE || status === LISTING_STATUS.NEW;
}

/**
 * Check if a listing is closed (sold/rented)
 */
export function isClosed(status: string): boolean {
  return status === LISTING_STATUS.SOLD || status === LISTING_STATUS.RENTED;
}

/**
 * Check if a listing status is under contract (PENDING, UNDER_AGREEMENT, CONTINGENT)
 */
export function isUnderContract(status: string): boolean {
  return (
    status === LISTING_STATUS.PENDING ||
    status === LISTING_STATUS.UNDER_AGREEMENT ||
    status === LISTING_STATUS.CONTINGENT
  );
}

/**
 * Check if a listing status is withdrawn/cancelled/expired
 */
export function isListingInactive(status: string): boolean {
  return (
    status === LISTING_STATUS.WITHDRAWN ||
    status === LISTING_STATUS.TEMPORARILY_WITHDRAWN ||
    status === LISTING_STATUS.EXPIRED ||
    status === LISTING_STATUS.CANCELLED ||
    status === LISTING_STATUS.CANCELED
  );
}

/**
 * Check if a listing is a draft
 */
export function isDraft(status: string): boolean {
  return status === LISTING_STATUS.DRAFT;
}

// =============================================================================
// STATUS HELPERS — AGENT
// =============================================================================

/**
 * Check if an agent is verified
 */
export function isVerifiedAgent(status: string): boolean {
  return status === AGENT_STATUS.VERIFIED;
}

/**
 * Check if an agent is pending verification
 */
export function isPendingAgent(status: string): boolean {
  return status === AGENT_STATUS.PENDING;
}

/**
 * Check if an agent has restricted or rejected status
 */
export function isAgentBlocked(status: string): boolean {
  return status === AGENT_STATUS.RESTRICTED || status === AGENT_STATUS.REJECTED;
}

// =============================================================================
// STATUS HELPERS — HOT SHEET
// =============================================================================

/**
 * Check if a hot sheet is active
 */
export function isHotSheetActive(status: string): boolean {
  return status === HOT_SHEET_STATUS.ACTIVE;
}

// =============================================================================
// LABEL LOOKUPS
// =============================================================================

/**
 * Get label for any status value
 */
export function getStatusLabel(status: string, domain: "listing" | "agent" | "hotsheet" = "listing"): string {
  switch (domain) {
    case "agent":
      return AGENT_STATUS_LABELS[status as AgentStatus] || status;
    case "hotsheet":
      return HOT_SHEET_STATUS_LABELS[status as HotSheetStatus] || status;
    case "listing":
    default:
      return LISTING_STATUS_LABELS[status] || status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || status;
  }
}

/**
 * Convenience wrapper for listing status labels
 */
export function getListingStatusLabel(status: string): string {
  return getStatusLabel(status, "listing");
}

/**
 * Convenience wrapper for agent status labels
 */
export function getAgentStatusLabel(status: string): string {
  return getStatusLabel(status, "agent");
}

/**
 * Convenience wrapper for hot sheet status labels
 */
export function getHotSheetStatusLabel(status: string): string {
  return getStatusLabel(status, "hotsheet");
}
