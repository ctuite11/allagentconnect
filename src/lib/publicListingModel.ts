import type { Database } from "@/integrations/supabase/types";

export type PublicListingRow =
  Database["public"]["Functions"]["get_public_listing"]["Returns"][number];

export type PublicListingAgentRow =
  Database["public"]["Functions"]["get_public_listing_agent"]["Returns"][number];

function asJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Shape used by ConsumerPropertyDetail after a public-RPC load. */
export function toPublicListingViewModel(
  listing: PublicListingRow,
  agent: PublicListingAgentRow | null,
) {
  return {
    ...listing,
    agent_id: agent?.agent_id ?? null,
    photos: asJsonArray(listing.photos),
    floor_plans: asJsonArray(listing.floor_plans),
  };
}

export function toPublicAgentProfile(agent: PublicListingAgentRow) {
  return {
    id: agent.agent_id,
    first_name: agent.first_name ?? "",
    last_name: agent.last_name ?? "",
    email: agent.email ?? "",
    phone: agent.phone ?? null,
    office_phone: agent.office_phone ?? null,
    cell_phone: agent.cell_phone ?? null,
    title: agent.title ?? null,
    headshot_url: agent.headshot_url ?? null,
    logo_url: agent.logo_url ?? null,
    company: agent.company ?? null,
    office_name: agent.office_name ?? null,
  };
}

function phoneDigits(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

/** Prefer cell for mobile; office_phone then phone for office, de-duped. */
export function resolvePublicAgentPhones(agent: {
  cell_phone?: string | null;
  phone?: string | null;
  office_phone?: string | null;
}): { mobile: string | null; office: string | null } {
  const mobile = agent.cell_phone?.trim() || null;
  const officeRaw =
    agent.office_phone?.trim() || agent.phone?.trim() || null;
  const office =
    officeRaw && phoneDigits(officeRaw) !== phoneDigits(mobile)
      ? officeRaw
      : null;
  return { mobile, office };
}
