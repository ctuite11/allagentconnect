/** Shared “Listed by” label for ListingCard / SearchListingCard (brokerage/agent priority). */

export type ListedBySource = {
  brokerage_name?: string | null;
  listing_brokerage?: string | null;
  /** Office / list office (e.g. hydrated from agent_profiles on map search) */
  list_office?: string | null;
  listing_agent_name?: string | null;
  agent_name?: string | null;
};

export type ListedByAgentProfile = {
  company?: string | null;
  office_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function pick(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t || null;
}

/**
 * Prefer listing MLS/office fields when present; otherwise use `agent_profiles` / embed.
 */
export function resolveListedByAttribution(
  listing: ListedBySource,
  agentProfile?: ListedByAgentProfile | null,
): string | null {
  const listingChain = [
    listing.brokerage_name,
    listing.listing_brokerage,
    listing.list_office,
    listing.listing_agent_name,
    listing.agent_name,
  ];
  for (const c of listingChain) {
    const v = pick(c);
    if (v) return v;
  }

  if (agentProfile) {
    const corp = pick(agentProfile.company) || pick(agentProfile.office_name);
    if (corp) return corp;
    const fullName = [agentProfile.first_name, agentProfile.last_name].map(pick).filter(Boolean).join(" ").trim();
    if (fullName) return fullName;
  }

  return null;
}

/** Brokerage / office only — for compact attribution footers (agent name lives on the contact chip). */
export function resolveBrokerageAttribution(
  listing: ListedBySource,
  agentProfile?: ListedByAgentProfile | null,
): string | null {
  for (const c of [listing.brokerage_name, listing.listing_brokerage, listing.list_office]) {
    const v = pick(c);
    if (v) return v;
  }

  if (agentProfile) {
    const corp = pick(agentProfile.company) || pick(agentProfile.office_name);
    if (corp) return corp;
  }

  return null;
}
