/**
 * Status Constants - Single Source of Truth
 * 
 * ALL status values, labels, and badge configurations MUST come from this file.
 * Do NOT use inline status strings anywhere in the codebase.
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
  UNDER_AGREEMENT: "under_agreement",
  PENDING: "pending",
  SOLD: "sold",
  RENTED: "rented",
  WITHDRAWN: "withdrawn",
  TEMPORARILY_WITHDRAWN: "temporarily_withdrawn",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  DRAFT: "draft",
  OFF_MARKET: "off_market",
} as const;

export type ListingStatus = (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  [LISTING_STATUS.ACTIVE]: "Active",
  [LISTING_STATUS.NEW]: "New",
  [LISTING_STATUS.COMING_SOON]: "Coming Soon",
  [LISTING_STATUS.BACK_ON_MARKET]: "Back on Market",
  [LISTING_STATUS.PRICE_CHANGED]: "Price Change",
  [LISTING_STATUS.UNDER_AGREEMENT]: "Under Agreement",
  [LISTING_STATUS.PENDING]: "Pending",
  [LISTING_STATUS.SOLD]: "Sold",
  [LISTING_STATUS.RENTED]: "Rented",
  [LISTING_STATUS.WITHDRAWN]: "Withdrawn",
  [LISTING_STATUS.TEMPORARILY_WITHDRAWN]: "Temporarily Withdrawn",
  [LISTING_STATUS.EXPIRED]: "Expired",
  [LISTING_STATUS.CANCELLED]: "Cancelled",
  [LISTING_STATUS.DRAFT]: "Draft",
  [LISTING_STATUS.OFF_MARKET]: "Off-Market",
};

// MLSPIN code mappings for Hot Sheet dialog
export const LISTING_STATUS_MLSPIN: Record<ListingStatus, string> = {
  [LISTING_STATUS.ACTIVE]: "ACT",
  [LISTING_STATUS.NEW]: "NEW",
  [LISTING_STATUS.COMING_SOON]: "CSO",
  [LISTING_STATUS.BACK_ON_MARKET]: "BOM",
  [LISTING_STATUS.PRICE_CHANGED]: "PCH",
  [LISTING_STATUS.UNDER_AGREEMENT]: "UAG",
  [LISTING_STATUS.PENDING]: "PND",
  [LISTING_STATUS.SOLD]: "SLD",
  [LISTING_STATUS.RENTED]: "RNT",
  [LISTING_STATUS.WITHDRAWN]: "WDN",
  [LISTING_STATUS.TEMPORARILY_WITHDRAWN]: "WDN",
  [LISTING_STATUS.EXPIRED]: "EXP",
  [LISTING_STATUS.CANCELLED]: "CAN",
  [LISTING_STATUS.DRAFT]: "DFT",
  [LISTING_STATUS.OFF_MARKET]: "OFF",
};

export const LISTING_STATUS_CONFIG: Record<ListingStatus, { bg: string; text: string; label: string }> = {
  [LISTING_STATUS.ACTIVE]: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
  [LISTING_STATUS.NEW]: { bg: "bg-emerald-50", text: "text-emerald-700", label: "New" },
  [LISTING_STATUS.COMING_SOON]: { bg: "bg-amber-50", text: "text-amber-700", label: "Coming Soon" },
  [LISTING_STATUS.BACK_ON_MARKET]: { bg: "bg-orange-50", text: "text-orange-700", label: "Back on Market" },
  [LISTING_STATUS.PRICE_CHANGED]: { bg: "bg-blue-50", text: "text-blue-700", label: "Price Change" },
  [LISTING_STATUS.UNDER_AGREEMENT]: { bg: "bg-violet-50", text: "text-violet-700", label: "Under Agreement" },
  [LISTING_STATUS.PENDING]: { bg: "bg-violet-50", text: "text-violet-700", label: "Pending" },
  [LISTING_STATUS.SOLD]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Sold" },
  [LISTING_STATUS.RENTED]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Rented" },
  [LISTING_STATUS.WITHDRAWN]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Withdrawn" },
  [LISTING_STATUS.TEMPORARILY_WITHDRAWN]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Temporarily Withdrawn" },
  [LISTING_STATUS.EXPIRED]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Expired" },
  [LISTING_STATUS.CANCELLED]: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Cancelled" },
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
