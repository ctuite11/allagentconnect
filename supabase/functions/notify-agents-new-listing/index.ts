import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderHotSheetMatchListingEmailCard } from "../_shared/listingEmailCard.ts";
import { resolveEmailBaseUrl } from "../_shared/aacPublicUrl.ts";
import {
  getVerifiedAgentAudience,
  partitionAudience,
  type EligibleAgent,
} from "../_shared/verifiedAgentAudience.ts";
import {
  countExistingReminders,
  reserveAndEnqueueMissingOpportunityReminder,
} from "../_shared/missingOpportunitiesEmail.ts";

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
  "off_market",
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
    const dryRun: boolean = body?.dry_run === true;
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

    // 2) Canonical activated+verified audience.
    const audience = await getVerifiedAgentAudience(admin);
    const audienceIds = audience.map((a) => a.agent_id);

    // Coverage rows for the domain-match predicate (only agents with coverage
    // are considered preferences_set for listing alerts, matching prior behavior).
    const { data: coverageRows, error: coverageError } = audienceIds.length
      ? await admin
          .from("agent_buyer_coverage_areas")
          .select("agent_id, zip_code, city, state, county, neighborhood")
          .in("agent_id", audienceIds)
      : { data: [], error: null };
    if (coverageError) throw coverageError;

    const coverageByAgent = new Map<string, CoverageRow[]>();
    for (const c of (coverageRows ?? []) as CoverageRow[]) {
      const arr = coverageByAgent.get(String(c.agent_id)) ?? [];
      arr.push(c);
      coverageByAgent.set(String(c.agent_id), arr);
    }

    const listingAgentId = (listing as any).agent_id
      ? String((listing as any).agent_id)
      : null;

    // No category opt-out surface for listing alerts today.
    const optedOut = new Set<string>();

    const partition = partitionAudience<EligibleAgent>(
      audience,
      (a) => coverageMatches(listing as ListingRow, coverageByAgent.get(a.agent_id) ?? []),
      listingAgentId,
      optedOut,
    );

    // Pre-check dedup for real-content sends (agent_sent_listings, per status).
    const realAgentIds = partition.real.map((r) => r.agent_id);
    const { data: existingSent } = realAgentIds.length
      ? await admin
          .from("agent_sent_listings")
          .select("agent_id")
          .eq("listing_id", listingId)
          .eq("status_at_send", status)
          .in("agent_id", realAgentIds)
      : { data: [] as any[] };
    const alreadySent = new Set(
      (existingSent ?? []).map((r: any) => String(r.agent_id)),
    );
    const freshReal = partition.real.filter((r) => !alreadySent.has(r.agent_id));

    // Pre-check reminder dedup.
    const reminderAgentIds = partition.reminder.map((a) => a.agent_id);
    const alreadyReminded = await countExistingReminders(
      admin,
      "new_listing",
      listingId,
      reminderAgentIds,
    );
    const freshReminder = partition.reminder.filter((a) => !alreadyReminded.has(a.agent_id));

    const address = [
      (listing as any).address,
      (listing as any).city,
      (listing as any).state,
      (listing as any).zip_code,
    ].filter(Boolean).join(", ");

    const baseReport = {
      listing_id: listingId,
      status_at_send: status,
      event_summary: {
        id: listingId,
        address,
        listing_agent_id: listingAgentId,
      },
      activated_verified_audience: audience.length,
      profile_complete: partition.counts.profile_complete,
      profile_incomplete: partition.counts.profile_incomplete,
      no_email: partition.counts.no_email,
      preferences_matched: partition.counts.preferences_matched,
      preferences_unset_fallback: partition.counts.preferences_unset_fallback,
      self_excluded: partition.counts.self_excluded,
      category_opted_out: partition.counts.category_opted_out,
      non_matching: partition.counts.non_matching,
      already_received_real: alreadySent.size,
      reminder_already_recorded: alreadyReminded.size,
      final_real_recipients: freshReal.length,
      final_reminder_recipients: freshReminder.length,
    };

    if (dryRun) {
      console.log(
        `[notify-agents-new-listing] DRY_RUN listing=${listingId} status=${status} audience=${audience.length} complete=${partition.counts.profile_complete} incomplete=${partition.counts.profile_incomplete} matched=${partition.counts.preferences_matched} fallback=${partition.counts.preferences_unset_fallback} already_real=${alreadySent.size} already_reminded=${alreadyReminded.size} final_real=${freshReal.length} final_reminder=${freshReminder.length}`,
      );
      return new Response(
        JSON.stringify({ dry_run: true, ...baseReport }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Real-content enqueue with existing reserve-first dedup semantics.
    const baseUrl = resolveEmailBaseUrl(
      Deno.env.get("EMAIL_BASE_URL") ||
        Deno.env.get("APP_BASE_URL") ||
        Deno.env.get("SITE_URL"),
    );
    const listingCardHtml = renderHotSheetMatchListingEmailCard(listing, { baseUrl });

    let enqueuedReal = 0;
    let skippedDup = 0;
    for (const c of partition.real) {
      const { error: dedupErr } = await admin
        .from("agent_sent_listings")
        .insert({
          agent_id: c.agent_id,
          listing_id: listingId,
          status_at_send: status,
        });
      if (dedupErr) {
        skippedDup++;
        continue;
      }
      const idempotencyKey = `agent-new-listing:${c.agent_id}:${listingId}:${status}`;
      const shortAddr = [
        (listing as any).address,
        (listing as any).city,
        (listing as any).state,
      ].filter(Boolean).join(", ");
      const { error: insertErr } = await admin.from("email_jobs").insert({
        idempotency_key: idempotencyKey,
        payload: {
          provider: "resend",
          template: "agent-new-listing-alert",
          to: c.email,
          subject: `New listing in your coverage: ${shortAddr || "see details"}`,
          category: "hot_sheet_alerts",
          metadata: {
            audience: "agent",
            reason: c.reason,
            agent_id: c.agent_id,
            listing_id: listingId,
            status_at_send: status,
          },
          variables: {
            userName: (c.first_name ?? "").toString().trim() || "there",
            hotSheetName: "New listing alert",
            matchCount: 1,
            listingsHtml: listingCardHtml,
            hotSheetLink: `${baseUrl}/property/${listingId}`,
          },
        },
      });
      if (insertErr) {
        await admin
          .from("agent_sent_listings")
          .delete()
          .eq("agent_id", c.agent_id)
          .eq("listing_id", listingId)
          .eq("status_at_send", status);
        console.error("[notify-agents-new-listing] enqueue failed:", insertErr);
        continue;
      }
      enqueuedReal++;
    }

    // 4) Reminder enqueue via reserve-first RPC.
    let enqueuedReminder = 0;
    let reminderConflict = 0;
    for (const a of partition.reminder) {
      const res = await reserveAndEnqueueMissingOpportunityReminder(admin, {
        agent_id: a.agent_id,
        event_type: "new_listing",
        event_id: listingId,
        email: a.email,
        firstName: a.first_name,
        baseUrl,
      });
      if (res.queued) enqueuedReminder++;
      else if (!res.reserved) reminderConflict++;
      else if (res.error) console.error("[notify-agents-new-listing] reminder RPC error:", res.error);
    }

    console.log(
      `[notify-agents-new-listing] listing=${listingId} real_enqueued=${enqueuedReal} real_skipped_dup=${skippedDup} reminder_enqueued=${enqueuedReminder} reminder_conflict=${reminderConflict}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        ...baseReport,
        real_enqueued: enqueuedReal,
        real_skipped_duplicate: skippedDup,
        reminder_enqueued: enqueuedReminder,
        reminder_skipped_duplicate: reminderConflict,
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