import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderHotSheetMatchListingEmailCard } from "../_shared/listingEmailCard.ts";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Statuses considered "searchable/qualifying" for a new-listing agent alert.
// Mirrors the set used by hot-sheet matching.
const QUALIFYING_STATUSES = new Set([
  "active",
  "coming_soon",
  "price_changed",
  "back_on_market",
  "extended",
  "reactivated",
  "new",
]);

type ListingRow = {
  id: string;
  status: string | null;
  agent_id: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  county: string | null;
  neighborhood: string | null;
};

type CoverageRow = {
  agent_id: string;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  county: string | null;
  neighborhood: string | null;
};

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function coverageMatches(listing: ListingRow, rows: CoverageRow[]): boolean {
  if (!rows.length) return false;
  const lState = norm(listing.state);
  const lCity = norm(listing.city);
  const lZip = norm(listing.zip_code);
  const lCounty = norm(listing.county);
  const lHood = norm(listing.neighborhood);

  // State-level rows (only state present) match any listing in that state.
  // More-specific rows must match on their populated field.
  for (const r of rows) {
    const rState = norm(r.state);
    if (!rState || rState !== lState) continue;

    const rCity = norm(r.city);
    const rZip = norm(r.zip_code);
    const rCounty = norm(r.county);
    const rHood = norm(r.neighborhood);

    const hasSpecific = Boolean(rCity || rZip || rCounty || rHood);
    if (!hasSpecific) return true; // state-only coverage

    if (rZip && rZip === lZip) return true;
    if (rCity && rCity === lCity) return true;
    if (rCounty && rCounty === lCounty) return true;
    if (rHood && rHood === lHood) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({} as any));
    const listingId: string | null = body?.listing_id ?? null;
    if (!listingId) {
      return new Response(
        JSON.stringify({ error: "listing_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) Load listing
    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .maybeSingle();

    if (listingError) throw listingError;
    if (!listing) {
      return new Response(
        JSON.stringify({ error: "listing not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const status = String((listing as any).status ?? "");
    if (!QUALIFYING_STATUSES.has(status)) {
      console.log(`[notify-agents-new-listing] skip: status="${status}" not qualifying`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "non-qualifying status", status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Verified agents = user_roles(agent) ∩ agent_settings(verified) ∩ agent_profiles(email)
    const { data: agentRoles, error: rolesError } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "agent");
    if (rolesError) throw rolesError;

    const agentIds = (agentRoles ?? []).map((r: any) => String(r.user_id));
    if (!agentIds.length) {
      return new Response(JSON.stringify({ enqueued: 0, reason: "no agents" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settingsRows, error: settingsError } = await admin
      .from("agent_settings")
      .select("user_id, preferences_set, agent_status")
      .in("user_id", agentIds)
      .eq("agent_status", "verified");
    if (settingsError) throw settingsError;

    const verifiedIds = (settingsRows ?? []).map((s: any) => String(s.user_id));
    if (!verifiedIds.length) {
      return new Response(JSON.stringify({ enqueued: 0, reason: "no verified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const prefsSetById = new Map<string, boolean>(
      (settingsRows ?? []).map((s: any) => [String(s.user_id), s.preferences_set === true]),
    );

    const { data: profiles, error: profilesError } = await admin
      .from("agent_profiles")
      .select("id, email, first_name")
      .in("id", verifiedIds);
    if (profilesError) throw profilesError;

    const { data: coverageRows, error: coverageError } = await admin
      .from("agent_buyer_coverage_areas")
      .select("agent_id, zip_code, city, state, county, neighborhood")
      .in("agent_id", verifiedIds);
    if (coverageError) throw coverageError;

    const coverageByAgent = new Map<string, CoverageRow[]>();
    for (const c of (coverageRows ?? []) as CoverageRow[]) {
      const key = String(c.agent_id);
      const arr = coverageByAgent.get(key) ?? [];
      arr.push(c);
      coverageByAgent.set(key, arr);
    }

    const listingAgentId = (listing as any).agent_id
      ? String((listing as any).agent_id)
      : null;

    type Candidate = {
      agentId: string;
      email: string;
      firstName: string;
      reason: "preferences_match" | "preferences_unset";
    };

    const seenEmail = new Set<string>();
    const candidates: Candidate[] = [];

    for (const p of (profiles ?? []) as any[]) {
      const agentId = String(p.id);
      if (listingAgentId && agentId === listingAgentId) continue; // self-exclude

      const email = norm(p.email);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      if (seenEmail.has(email)) continue;

      const coverage = coverageByAgent.get(agentId) ?? [];
      const prefsMarkedSet = prefsSetById.get(agentId) === true;
      // Canonical "preferences set": preferences_set flag OR any coverage row.
      const hasPrefs = prefsMarkedSet || coverage.length > 0;

      let reason: Candidate["reason"];
      if (!hasPrefs) {
        reason = "preferences_unset";
      } else {
        if (!coverageMatches(listing as ListingRow, coverage)) continue;
        reason = "preferences_match";
      }

      seenEmail.add(email);
      candidates.push({
        agentId,
        email,
        firstName: (p.first_name ?? "").toString().trim() || "there",
        reason,
      });
    }

    if (!candidates.length) {
      console.log("[notify-agents-new-listing] no eligible agents");
      return new Response(JSON.stringify({ enqueued: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Dedup via agent_sent_listings insert (unique constraint)
    const baseUrl = resolveEmailBaseUrl(
      Deno.env.get("EMAIL_BASE_URL") ||
        Deno.env.get("APP_BASE_URL") ||
        Deno.env.get("SITE_URL"),
    );
    const listingCardHtml = renderHotSheetMatchListingEmailCard(listing, {
      baseUrl,
    });

    let enqueued = 0;
    let skippedDup = 0;
    for (const c of candidates) {
      const { error: dedupErr } = await admin
        .from("agent_sent_listings")
        .insert({
          agent_id: c.agentId,
          listing_id: listingId,
          status_at_send: status,
        });

      if (dedupErr) {
        // Unique violation → already sent for this (agent, listing, status)
        skippedDup++;
        continue;
      }

      const idempotencyKey = `agent-new-listing:${c.agentId}:${listingId}:${status}`;
      const address = [
        (listing as any).address,
        (listing as any).city,
        (listing as any).state,
      ]
        .filter(Boolean)
        .join(", ");

      const { error: insertErr } = await admin.from("email_jobs").insert({
        idempotency_key: idempotencyKey,
        payload: {
          provider: "resend",
          template: "agent-new-listing-alert",
          to: c.email,
          subject: `New listing in your coverage: ${address || "see details"}`,
          category: "hot_sheet_alerts",
          metadata: {
            audience: "agent",
            reason: c.reason,
            agent_id: c.agentId,
            listing_id: listingId,
            status_at_send: status,
          },
          variables: {
            userName: c.firstName,
            hotSheetName: "New listing alert",
            matchCount: 1,
            listingsHtml: listingCardHtml,
            hotSheetLink: `${baseUrl}/property/${listingId}`,
          },
        },
      });

      if (insertErr) {
        // Roll back the dedup marker so a retry can re-enqueue.
        await admin
          .from("agent_sent_listings")
          .delete()
          .eq("agent_id", c.agentId)
          .eq("listing_id", listingId)
          .eq("status_at_send", status);
        console.error("[notify-agents-new-listing] enqueue failed:", insertErr);
        continue;
      }

      enqueued++;
    }

    console.log(
      `[notify-agents-new-listing] listing=${listingId} status=${status} candidates=${candidates.length} enqueued=${enqueued} skippedDup=${skippedDup}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        listing_id: listingId,
        status_at_send: status,
        candidates: candidates.length,
        enqueued,
        skipped_duplicate: skippedDup,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[notify-agents-new-listing] Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});