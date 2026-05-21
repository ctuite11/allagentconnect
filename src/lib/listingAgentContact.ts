import type { AgentSplitListing } from "@/lib/agentSplitResults";

export type ListingAgentContact = {
  agentId: string;
  agentEmail: string;
  agentName: string;
};

/** Resolve list-side agent contact from a listing row (agent search / hot sheet). */
export function listingAgentContactFromRow(row: unknown): ListingAgentContact | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const agentId = typeof r.agent_id === "string" ? r.agent_id.trim() : "";
  const agentEmail = typeof r.agent_email === "string" ? r.agent_email.trim() : "";
  if (!agentId || !agentEmail) return null;

  const agentNameRaw =
    (typeof r.agent_name === "string" && r.agent_name.trim()) ||
    (typeof r.listing_agent_name === "string" && r.listing_agent_name.trim()) ||
    "";

  const profile = r.agent_profile as Record<string, unknown> | undefined;
  const fromProfile =
    profile && (typeof profile.first_name === "string" || typeof profile.last_name === "string")
      ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
      : "";

  const agentName = agentNameRaw || fromProfile || "Listing agent";
  return { agentId, agentEmail, agentName };
}

export function listingEmailSubjectFromRow(row: unknown): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const r = row as Record<string, unknown>;
  const address = typeof r.address === "string" ? r.address.trim() : "";
  const city = typeof r.city === "string" ? r.city.trim() : "";
  const state = typeof r.state === "string" ? r.state.trim() : "";
  const line = [address, city, state].filter(Boolean).join(", ");
  return line ? `Listing: ${line}` : undefined;
}

export function agentSplitListingAgentContact(listing: AgentSplitListing): ListingAgentContact | null {
  return listingAgentContactFromRow(listing);
}
