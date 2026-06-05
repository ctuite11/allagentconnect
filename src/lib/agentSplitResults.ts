import {
  listingEffectiveNumericPrice,
  type ListingPriceFields,
} from "@/lib/formatListingPriceDisplay";
import { compareListingsByRecency } from "@/lib/listingRecencySort";

/** Minimal listing row for agent split map/list results surfaces. */
export type AgentSplitListing = Record<string, unknown> & {
  id: string;
  list_date?: string | null;
  created_at?: string | null;
};

export function listingRowForAgentSplitMapCompact<T extends AgentSplitListing>(row: T): T {
  return {
    ...row,
    brokerage_name: null,
    agent_name: null,
    listing_brokerage: null,
    listing_agent_name: null,
    list_office: null,
    list_office_phone: null,
    agent_email: null,
    agent_phone: null,
    agent_profile: undefined,
  };
}

export function sortAgentSplitListings<T extends AgentSplitListing>(
  listings: T[],
  sortColumn: string,
  sortDirection: "asc" | "desc",
): T[] {
  const rows = [...listings];
  const dir = sortDirection === "asc" ? 1 : -1;

  if (sortColumn === "price") {
    return rows.sort((a, b) => {
      const ea = listingEffectiveNumericPrice(a as unknown as ListingPriceFields);
      const eb = listingEffectiveNumericPrice(b as unknown as ListingPriceFields);
      const aMissing = ea == null;
      const bMissing = eb == null;
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return (ea - eb) * dir;
    });
  }

  if (sortColumn === "created_at" || sortColumn === "list_date") {
    return rows.sort((a, b) =>
      compareListingsByRecency(a, b, sortDirection === "asc" ? "asc" : "desc"),
    );
  }

  return rows.sort((a, b) => {
    const av = String((a as Record<string, unknown>)[sortColumn] ?? "");
    const bv = String((b as Record<string, unknown>)[sortColumn] ?? "");
    return av.localeCompare(bv) * dir;
  });
}
