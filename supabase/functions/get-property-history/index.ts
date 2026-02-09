import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Normalize an address string for matching: lowercase, trim, strip punctuation, collapse whitespace */
function normalizeAddress(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .trim()
    .replace(/[.,#]/g, "")          // strip common punctuation
    .replace(/\bstreet\b/g, "st")   // normalize street suffixes
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\bplace\b/g, "pl")
    .replace(/\broad\b/g, "rd")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\blane\b/g, "ln")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bcircle\b/g, "cir")
    .replace(/\bterrace\b/g, "ter")
    .replace(/\bparkway\b/g, "pkwy")
    .replace(/\s+/g, " ");          // collapse whitespace
}

function norm(val: string | null | undefined): string {
  return (val ?? "").toLowerCase().trim();
}

const MAX_LISTINGS = 10;
const MAX_STATUS_EVENTS = 20;
const MAX_PRICE_CHANGES = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Parse params
    const url = new URL(req.url);
    const address = url.searchParams.get("address");
    const city = url.searchParams.get("city");
    const state = url.searchParams.get("state");
    const unitNumber = url.searchParams.get("unit_number") || null;
    const excludeListingId = url.searchParams.get("exclude_listing_id") || null;
    const attomId = url.searchParams.get("attom_id") || null;

    if (!address || !city || !state) {
      return new Response(
        JSON.stringify({ error: "address, city, and state are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Match listings ----
    let matchedListings: any[] = [];

    // Priority 1: attom_id match (strongest signal)
    if (attomId) {
      const { data } = await adminClient
        .from("listings")
        .select("id, listing_type, status, price, created_at, active_date, expiration_date, cancelled_at, property_type, is_relisting, original_listing_id, agent_id, address, unit_number, city, state, attom_id")
        .eq("attom_id", attomId)
        .order("created_at", { ascending: false })
        .limit(MAX_LISTINGS);

      if (data && data.length > 0) {
        matchedListings = data;
      }
    }

    // Priority 2: normalized address/city/state
    if (matchedListings.length === 0) {
      // Fetch broader set and filter in-memory for normalized matching
      const { data } = await adminClient
        .from("listings")
        .select("id, listing_type, status, price, created_at, active_date, expiration_date, cancelled_at, property_type, is_relisting, original_listing_id, agent_id, address, unit_number, city, state, attom_id")
        .ilike("city", city.trim())
        .ilike("state", state.trim())
        .order("created_at", { ascending: false })
        .limit(200); // fetch a reasonable set to filter

      if (data) {
        const normalizedInput = normalizeAddress(address);
        const normalizedUnit = norm(unitNumber);

        matchedListings = data.filter((l) => {
          if (normalizeAddress(l.address) !== normalizedInput) return false;
          // If caller specified a unit, require match; otherwise match all units at that address
          if (unitNumber && norm(l.unit_number) !== normalizedUnit) return false;
          return true;
        }).slice(0, MAX_LISTINGS);
      }
    }

    // Exclude current listing
    if (excludeListingId) {
      matchedListings = matchedListings.filter((l) => l.id !== excludeListingId);
    }

    if (matchedListings.length === 0) {
      return new Response(
        JSON.stringify({ listings: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Enrich with agent info, status history, price history ----
    const listingIds = matchedListings.map((l) => l.id);
    const agentIds = [...new Set(matchedListings.map((l) => l.agent_id).filter(Boolean))];

    // Fetch agent display names (whitelisted fields only)
    const agentMap: Record<string, { name: string; office: string | null }> = {};
    if (agentIds.length > 0) {
      const { data: agents } = await adminClient
        .from("agent_profiles")
        .select("id, first_name, last_name, office_name")
        .in("id", agentIds);

      if (agents) {
        for (const a of agents) {
          agentMap[a.id] = {
            name: `${a.first_name} ${a.last_name}`,
            office: a.office_name || null,
          };
        }
      }
    }

    // Fetch status history (bounded)
    const { data: statusHistory } = await adminClient
      .from("listing_status_history")
      .select("listing_id, old_status, new_status, changed_at, notes")
      .in("listing_id", listingIds)
      .order("changed_at", { ascending: true });

    // Fetch price history (bounded)
    const { data: priceHistoryData } = await adminClient
      .from("listing_price_history")
      .select("listing_id, old_price, new_price, changed_at")
      .in("listing_id", listingIds)
      .order("changed_at", { ascending: true });

    // Group and bound per listing
    const statusByListing: Record<string, any[]> = {};
    const priceByListing: Record<string, any[]> = {};

    for (const sh of statusHistory || []) {
      if (!statusByListing[sh.listing_id]) statusByListing[sh.listing_id] = [];
      statusByListing[sh.listing_id].push(sh);
    }
    for (const ph of priceHistoryData || []) {
      if (!priceByListing[ph.listing_id]) priceByListing[ph.listing_id] = [];
      priceByListing[ph.listing_id].push(ph);
    }

    // Build response
    const result = matchedListings.map((l) => {
      const agent = agentMap[l.agent_id];
      const statusEvents = (statusByListing[l.id] || []).slice(-MAX_STATUS_EVENTS);
      const priceEvents = (priceByListing[l.id] || []).slice(-MAX_PRICE_CHANGES);

      return {
        listing_id: l.id,
        listing_type: l.listing_type,
        status: l.status,
        price: l.price,
        created_at: l.created_at,
        active_date: l.active_date,
        expiration_date: l.expiration_date,
        cancelled_at: l.cancelled_at,
        property_type: l.property_type,
        is_relisting: l.is_relisting,
        original_listing_id: l.original_listing_id,
        agent_name: agent?.name || null,
        office_name: agent?.office || null,
        status_history: statusEvents.map((e: any) => ({
          old_status: e.old_status,
          new_status: e.new_status,
          changed_at: e.changed_at,
        })),
        price_history: priceEvents.map((e: any) => ({
          old_price: e.old_price,
          new_price: e.new_price,
          changed_at: e.changed_at,
        })),
      };
    });

    return new Response(
      JSON.stringify({ listings: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
