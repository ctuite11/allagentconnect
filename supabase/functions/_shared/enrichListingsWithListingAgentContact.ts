/**
 * Attach listing-agent display name, email, and phone onto listing rows for
 * agent-facing emails. Listings only store `agent_id`; contact lives on
 * `agent_profiles`.
 */
export async function enrichListingsWithListingAgentContact(
  // deno-lint-ignore no-explicit-any
  supabase: { from: (table: string) => any },
  // deno-lint-ignore no-explicit-any
  listings: any[],
  // deno-lint-ignore no-explicit-any
): Promise<any[]> {
  if (!Array.isArray(listings) || listings.length === 0) return listings ?? [];

  const agentIds = [
    ...new Set(
      listings
        .map((l) => (l?.agent_id != null ? String(l.agent_id) : ""))
        .filter(Boolean),
    ),
  ];
  if (agentIds.length === 0) return listings;

  const { data: profiles, error } = await supabase
    .from("agent_profiles")
    .select("id, first_name, last_name, email, company, office_name, cell_phone, phone")
    .in("id", agentIds);

  if (error) {
    console.warn("[enrichListingsWithListingAgentContact]", error.message);
    return listings;
  }

  const byId = new Map<string, {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    company: string | null;
    office_name: string | null;
    cell_phone: string | null;
    phone: string | null;
  }>();
  for (const p of profiles ?? []) {
    byId.set(String(p.id), p);
  }

  return listings.map((listing) => {
    const profile = listing?.agent_id ? byId.get(String(listing.agent_id)) : null;
    if (!profile) return listing;
    const name = [profile.first_name, profile.last_name]
      .map((p) => (p ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const email = (profile.email ?? "").trim();
    const phone = (profile.cell_phone ?? "").trim() || (profile.phone ?? "").trim();
    const company = (profile.company ?? "").trim();
    const officeName = (profile.office_name ?? "").trim();
    // Some profiles store a truncated `company` (e.g. "Donnelly and") while
    // `office_name` holds the complete stored value ("Donnelly and Co").
    // Prefer the complete stored value; never invent or expand a name.
    const brokerage =
      officeName &&
        (!company ||
          officeName.toLowerCase().startsWith(company.toLowerCase()))
        ? officeName
        : company;
    return {
      ...listing,
      listing_agent_name: name || listing.listing_agent_name || listing.agent_name || "",
      listing_agent_email: email || listing.listing_agent_email || listing.agent_email || "",
      listing_agent_phone: phone || listing.listing_agent_phone || listing.agent_phone || "",
      agent_name: name || listing.agent_name || "",
      agent_email: email || listing.agent_email || "",
      agent_phone: phone || listing.agent_phone || "",
      brokerage_name: listing.brokerage_name || listing.listing_brokerage || brokerage || "",
    };
  });
}
