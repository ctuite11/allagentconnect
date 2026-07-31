import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getVerifiedAgentAudience,
  partitionAudience,
  type EligibleAgent,
} from "../_shared/verifiedAgentAudience.ts";
import { matchesCommunicationPreferences } from "../_shared/communicationPreferencesMatcher.ts";
import { isHotSheetSyncedClientNeed } from "../_shared/emailStreams.ts";

/**
 * READ-ONLY Communications Center dry run for a broadcast or client_need.
 * Does not insert email_jobs, does not invoke producers, does not send.
 *
 * Body:
 *   { broadcast_id?: string, client_need_id?: string }
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
    const broadcastId = body?.broadcast_id as string | undefined;
    const clientNeedId = body?.client_need_id as string | undefined;
    if (!broadcastId && !clientNeedId) {
      return new Response(
        JSON.stringify({ error: "broadcast_id or client_need_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let category = "buyer_need";
    let preferenceEvent: Record<string, unknown> = {};
    let senderId: string | null = null;
    let eventSummary: Record<string, unknown> = {};
    let template = "client-need-notification";
    let idempotencyPrefix = "client-need";

    if (broadcastId) {
      const { data: broadcast, error } = await supabase
        .from("comms_broadcasts")
        .select("*")
        .eq("id", broadcastId)
        .maybeSingle();
      if (error) throw error;
      if (!broadcast) {
        return new Response(JSON.stringify({ error: "broadcast not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      category = String((broadcast as any).category || "buyer_need");
      senderId = (broadcast as any).sender_id ?? null;
      const criteria = (broadcast as any).parsed_criteria || (broadcast as any).criteria || {};
      preferenceEvent = {
        state: criteria.state ?? null,
        county: Array.isArray(criteria.counties) ? criteria.counties[0] : null,
        city: Array.isArray(criteria.cities) ? criteria.cities[0] : null,
        price: criteria.maxPrice ?? criteria.minPrice ?? null,
        propertyTypes: criteria.propertyTypes ?? [],
      };
      eventSummary = { broadcast_id: broadcastId, category, criteria };
      template = "client-need-broadcast";
      idempotencyPrefix = `client-need-broadcast:${broadcastId}`;
    } else if (clientNeedId) {
      const { data: need, error } = await supabase
        .from("client_needs")
        .select("*")
        .eq("id", clientNeedId)
        .maybeSingle();
      if (error) throw error;
      if (!need) {
        return new Response(JSON.stringify({ error: "client_need not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (isHotSheetSyncedClientNeed(need.description)) {
        return new Response(
          JSON.stringify({
            dry_run: true,
            writes: false,
            sends: false,
            skipped: true,
            reason: "hot_sheet_synced_client_need",
            note: "Hot Sheet sync rows are excluded from Communications Center broadcasts",
            client_need_id: clientNeedId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      category = "buyer_need";
      senderId = need.submitted_by ?? null;
      preferenceEvent = {
        state: need.state,
        city: need.city,
        price: need.max_price > 0 ? need.max_price : null,
        propertyTypes: need.property_type ? [need.property_type] : [],
      };
      eventSummary = {
        client_need_id: clientNeedId,
        category,
        state: need.state,
        city: need.city,
        property_type: need.property_type,
        max_price: need.max_price,
      };
      template = "client-need-notification";
      idempotencyPrefix = `client-need:${clientNeedId}`;
    }

    const audience = await getVerifiedAgentAudience(supabase);
    const optedOut = new Set<string>();
    // Category opt-outs for UI broadcasts
    if (broadcastId) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("user_id, buyer_need, renter_need, sales_intel, general_discussion")
        .in(
          "user_id",
          audience.map((a) => a.agent_id),
        );
      for (const p of prefs || []) {
        const flag =
          category === "renter_need"
            ? p.renter_need
            : category === "sales_intel"
            ? p.sales_intel
            : category === "general_discussion"
            ? p.general_discussion
            : p.buyer_need;
        if (flag === false) optedOut.add(p.user_id);
      }
    } else {
      const { data: optOutRows } = await supabase
        .from("agent_profiles")
        .select("id, receive_buyer_alerts")
        .in(
          "id",
          audience.map((a) => a.agent_id),
        );
      for (const r of optOutRows || []) {
        if (r.receive_buyer_alerts === false) optedOut.add(r.id);
      }
    }

    const reasons = new Map<string, string>();
    const partition = partitionAudience<EligibleAgent>(
      audience,
      (a) => {
        const result = matchesCommunicationPreferences(
          a.savedPrefs,
          preferenceEvent as any,
        );
        if (result.matches) {
          reasons.set(
            a.agent_id,
            result.anyDimensionConfigured
              ? "preferences_matched"
              : "preferences_unset_fallback",
          );
        } else {
          reasons.set(
            a.agent_id,
            `failed_${result.failedDimension || "unknown"}`,
          );
        }
        return result.matches;
      },
      senderId,
      optedOut,
    );

    const eligible = partition.real.map((a) => ({
      agent_id: a.agent_id,
      email: a.email,
      reason: reasons.get(a.agent_id) || a.reason,
      template,
      idempotency_key: `${idempotencyPrefix}:${a.agent_id}`,
      stream: "communications",
    }));

    const excluded = [
      ...partition.reminder.map((a) => ({
        agent_id: a.agent_id,
        reason: "profile_incomplete_reminder_path",
      })),
      ...audience
        .filter((a) => optedOut.has(a.agent_id))
        .map((a) => ({ agent_id: a.agent_id, reason: "category_or_buyer_alerts_opted_out" })),
      ...audience
        .filter(
          (a) =>
            !optedOut.has(a.agent_id) &&
            senderId &&
            a.agent_id === senderId,
        )
        .map((a) => ({ agent_id: a.agent_id, reason: "self_excluded_sender" })),
    ];

    return new Response(
      JSON.stringify(
        {
          dry_run: true,
          writes: false,
          sends: false,
          queue_stream: "communications",
          category,
          event_summary: eventSummary,
          activated_verified_audience: audience.length,
          eligible_agents: eligible,
          excluded_agents: excluded,
          counts: partition.counts,
          proposed_template: template,
          notes: [
            "No Hot Sheet tables were written",
            "No hot_sheet_sent_listings reads/writes",
            "Audience uses Communications Center preferences only",
          ],
        },
        null,
        2,
      ),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[dry-run-comms-broadcast]", error);
    return new Response(JSON.stringify({ error: error?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
