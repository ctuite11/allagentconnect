import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  agentIdempotencyKey,
  clientListingIdempotencyKey,
  isAgentEligibleForListing,
  subscriberListingIdempotencyKey,
} from "../_shared/hotSheetAgentDelivery.ts";
import { getHotSheetStatusCopy, normalizeStatusKey } from "../_shared/hotSheetStatusCopy.ts";

/**
 * READ-ONLY Hot Sheet dry run for a listing.
 * Does not insert email_jobs, does not invoke producers, does not send.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const listingId = body?.listing_id as string | undefined;
    if (!listingId) {
      return new Response(JSON.stringify({ error: "listing_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: listing, error: listingErr } = await supabase
      .from("listings")
      .select("id, status, agent_id, city, state, property_type, price, address")
      .eq("id", listingId)
      .maybeSingle();
    if (listingErr) throw listingErr;
    if (!listing) {
      return new Response(JSON.stringify({ error: "listing not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hotSheets, error: hsErr } = await supabase
      .from("hot_sheets")
      .select("id, user_id, name, criteria, is_active, notify_agent_email, notification_schedule")
      .eq("is_active", true)
      .eq("notification_schedule", "immediately");
    if (hsErr) throw hsErr;

    const report: Record<string, unknown> = {
      dry_run: true,
      writes: false,
      sends: false,
      queue_stream: "hot_sheet",
      listing: {
        id: listing.id,
        status: listing.status,
        city: listing.city,
        state: listing.state,
        property_type: listing.property_type,
        price: listing.price,
        agent_id: listing.agent_id,
      },
      matching_hot_sheets: [] as unknown[],
      non_matching_hot_sheets: [] as unknown[],
      proposed_jobs: [] as unknown[],
    };

    for (const hs of hotSheets || []) {
      const { data: matches, error: matchErr } = await supabase.rpc(
        "check_hot_sheet_matches",
        { p_hot_sheet_id: hs.id },
      );
      if (matchErr) {
        (report.non_matching_hot_sheets as any[]).push({
          id: hs.id,
          name: hs.name,
          reason: `match_rpc_error: ${matchErr.message}`,
        });
        continue;
      }
      const matched = (matches || []).some(
        (m: any) => String(m.listing_id) === String(listingId),
      );
      if (!matched) {
        (report.non_matching_hot_sheets as any[]).push({
          id: hs.id,
          name: hs.name,
          reason: "listing_does_not_pass_check_hot_sheet_matches",
          criteria: hs.criteria,
        });
        continue;
      }

      const status = String(listing.status || "active");
      const { data: prior } = await supabase
        .from("hot_sheet_sent_listings")
        .select("status_at_send")
        .eq("hot_sheet_id", hs.id)
        .eq("listing_id", listingId)
        .eq("status_at_send", status)
        .maybeSingle();

      const kind = prior ? "already_sent_at_status" : "new_or_status_change";
      const statusKey = normalizeStatusKey(status);
      const copy = getHotSheetStatusCopy(statusKey);

      const agentEligible = isAgentEligibleForListing(hs, listing as any);
      const exclusions: string[] = [];
      if (hs.notify_agent_email !== true) exclusions.push("notify_agent_email=false");
      if (listing.agent_id && String(listing.agent_id) === String(hs.user_id)) {
        exclusions.push("listing_owner_self_exclusion");
      }

      const { data: clients } = await supabase
        .from("hot_sheet_clients")
        .select("client_id, clients(email, first_name)")
        .eq("hot_sheet_id", hs.id);

      const { data: tokens } = await supabase
        .from("share_tokens")
        .select("accepted_at, payload")
        .eq("agent_id", hs.user_id)
        .eq("payload->>type", "client_hotsheet_invite")
        .eq("payload->>hot_sheet_id", hs.id)
        .not("accepted_at", "is", null);

      const acceptedEmails = new Set(
        (tokens || [])
          .map((t: any) => t.payload?.client_email?.toLowerCase?.())
          .filter(Boolean),
      );
      const acceptedIds = new Set(
        (tokens || [])
          .map((t: any) => t.payload?.client_id && String(t.payload.client_id))
          .filter(Boolean),
      );

      const clientRecipients: any[] = [];
      const clientExcluded: any[] = [];
      for (const row of clients || []) {
        const client = Array.isArray((row as any).clients)
          ? (row as any).clients[0]
          : (row as any).clients;
        const email = client?.email?.toLowerCase?.();
        const cid = row.client_id ? String(row.client_id) : null;
        const accepted = (cid && acceptedIds.has(cid)) || (email && acceptedEmails.has(email));
        if (!email) {
          clientExcluded.push({ client_id: cid, reason: "missing_email" });
        } else if (!accepted) {
          clientExcluded.push({ client_id: cid, email, reason: "invite_not_accepted" });
        } else {
          clientRecipients.push({
            client_id: cid,
            email,
            template: prior ? "hot-sheet-status-change" : "new-match-notification",
            idempotency_key: clientListingIdempotencyKey(
              cid || email,
              hs.id,
              listingId,
              status,
            ),
            subject: prior
              ? copy.subject(hs.name)
              : `New matches in your Hot Sheet: ${hs.name}`,
          });
        }
      }

      const { data: subscribers } = await supabase
        .from("hot_sheet_subscribers" as any)
        .select("id, email, first_name")
        .eq("hot_sheet_id", hs.id)
        .eq("status", "active");

      const subscriberRecipients = (subscribers || []).map((sub: any) => ({
        subscriber_id: sub.id,
        email: sub.email,
        template: prior
          ? "hot-sheet-subscriber-status-change"
          : "hot-sheet-subscriber-update",
        idempotency_key: subscriberListingIdempotencyKey(
          String(sub.id),
          hs.id,
          listingId,
          status,
        ),
        subject: prior ? copy.subject(hs.name) : `New matches in ${hs.name}`,
      }));

      const agentJobs = [];
      if (agentEligible) {
        const { data: agentProfile } = await supabase
          .from("agent_profiles")
          .select("email, first_name")
          .eq("id", hs.user_id)
          .maybeSingle();
        if (!agentProfile?.email) {
          exclusions.push("agent_email_missing");
        } else {
          agentJobs.push({
            email: agentProfile.email,
            template: prior ? "hot-sheet-status-change" : "new-match-notification",
            idempotency_key: agentIdempotencyKey(hs.id, listingId, status),
            subject: prior
              ? copy.subject(hs.name)
              : `New matches in your Hot Sheet: ${hs.name}`,
          });
        }
      }

      const sheetReport = {
        id: hs.id,
        name: hs.name,
        matched: true,
        match_kind: kind,
        why_matched: "check_hot_sheet_matches returned this listing_id",
        criteria: hs.criteria,
        notify_agent_email: hs.notify_agent_email,
        notification_schedule: hs.notification_schedule,
        agent_recipients: agentJobs,
        client_recipients: clientRecipients,
        subscriber_recipients: subscriberRecipients,
        excluded: {
          agent: exclusions,
          clients: clientExcluded,
        },
        proposed_queue_stream: "hot_sheet",
      };
      (report.matching_hot_sheets as any[]).push(sheetReport);
      (report.proposed_jobs as any[]).push(
        ...agentJobs.map((j) => ({ hot_sheet_id: hs.id, audience: "agent", ...j, stream: "hot_sheet" })),
        ...clientRecipients.map((j) => ({ hot_sheet_id: hs.id, audience: "client", ...j, stream: "hot_sheet" })),
        ...subscriberRecipients.map((j) => ({
          hot_sheet_id: hs.id,
          audience: "subscriber",
          ...j,
          stream: "hot_sheet",
        })),
      );
    }

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[dry-run-hot-sheet-listing]", error);
    return new Response(JSON.stringify({ error: error?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
