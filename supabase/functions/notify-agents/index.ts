import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import {
  getVerifiedAgentAudience,
  partitionAudience,
  type EligibleAgent,
} from "../_shared/verifiedAgentAudience.ts";
import { matchesCommunicationPreferences } from "../_shared/communicationPreferencesMatcher.ts";
import { loadCommsOptIn } from "../_shared/commsOptIn.ts";
import {
  countExistingReminders,
  reserveAndEnqueueMissingOpportunityReminder,
} from "../_shared/missingOpportunitiesEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Legacy county-form Buyer Need broadcaster.
// Requires a durable `client_need_id` (canonical event) so we can dedup.
interface BuyerNeedRequest {
  client_need_id: string;
  countyId: string;
  propertyType: string;
  maxPrice: string | number;
  bedrooms?: string | number;
  bathrooms?: string | number;
  description?: string;
  dry_run?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 5/min per user
    const { data: rl } = await supabase.rpc("rate_limit_consume", {
      p_key: `route:notify-agents|user:${user.id}`,
      p_window_seconds: 60,
      p_limit: 5,
    });
    const rate = Array.isArray(rl) ? rl[0] : rl;
    if (rate && rate.allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: BuyerNeedRequest = await req.json();
    if (!body?.client_need_id || !body?.countyId) {
      throw new Error("client_need_id and countyId are required");
    }
    const dryRun: boolean = body?.dry_run === true;

    // County lookup
    const { data: county } = await supabase
      .from("counties")
      .select("id, name, state")
      .eq("id", body.countyId)
      .single();
    if (!county) throw new Error("County not found");

    // Canonical audience
    const audience = await getVerifiedAgentAudience(supabase);

    // Independent-dimension Comms-Center match: build the preference event
    // from the county-scoped payload. County-only broadcasts carry no city,
    // ZIP, or neighborhood; matcher treats those event fields as unset so
    // saved rows without those fields still pass on the location dimension.
    const maxPriceNum = parseFloat(String(body.maxPrice)) || 0;
    const preferenceEvent = {
      state: county.state,
      county: county.name,
      price: maxPriceNum > 0 ? maxPriceNum : null,
      propertyTypes: body.propertyType ? [String(body.propertyType)] : [],
    };

    // Explicit opt-out (authoritative)
    const { data: optOutRows } = await supabase
      .from("agent_profiles")
      .select("id, receive_buyer_alerts")
      .in("id", audience.map((a) => a.agent_id));
    const optedOut = new Set<string>();
    for (const r of optOutRows || []) {
      if (r.receive_buyer_alerts === false) optedOut.add(r.id);
    }

    // Comms Center opt-in gate (authoritative — never rely on
    // agent_profiles.receive_buyer_alerts alone). Missing preferences row,
    // master switch off, or category channel off ⇒ muted.
    const optIn = await loadCommsOptIn(
      supabase,
      audience.map((a) => a.agent_id),
      "buyer_need",
    );
    const partition = partitionAudience<EligibleAgent>(
      audience,
      (a) => matchesCommunicationPreferences(a.savedPrefs, preferenceEvent).matches,
      user.id,
      optedOut,
      optIn.allowed,
    );

    // Defence in depth: drop anything not explicitly allowed.
    partition.real = partition.real.filter((r) => optIn.allowed.has(r.agent_id));

    // Durable dedup
    const realIds = partition.real.map((r) => r.agent_id);
    const { data: alreadySent } = realIds.length
      ? await supabase
          .from("agent_sent_client_needs")
          .select("agent_id")
          .eq("client_need_id", body.client_need_id)
          .in("agent_id", realIds)
      : { data: [] as any[] };
    const sentSet = new Set((alreadySent || []).map((r: any) => r.agent_id));
    const freshReal = partition.real.filter((r) => !sentSet.has(r.agent_id));

    // Reminder pre-check
    const reminderIds = partition.reminder.map((a) => a.agent_id);
    const alreadyReminded = await countExistingReminders(
      supabase,
      "client_need_county",
      body.client_need_id,
      reminderIds,
    );
    const freshReminder = partition.reminder.filter((a) => !alreadyReminded.has(a.agent_id));

    const propertyTypeDisplay = String(body.propertyType)
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const countyName = `${county.name}, ${county.state}`;

    const baseReport = {
      client_need_id: body.client_need_id,
      county: countyName,
      activated_verified_audience: audience.length,
      profile_complete: partition.counts.profile_complete,
      profile_incomplete: partition.counts.profile_incomplete,
      no_email: partition.counts.no_email,
      preferences_matched: partition.counts.preferences_matched,
      preferences_unset_skipped: partition.counts.preferences_unset_skipped,
      comms_opt_in_blocked: optIn.blocked.size,
      self_excluded: partition.counts.self_excluded,
      category_opted_out: partition.counts.category_opted_out,
      non_matching: partition.counts.non_matching,
      already_received_real: sentSet.size,
      reminder_already_recorded: alreadyReminded.size,
      final_real_recipients: freshReal.length,
      final_reminder_recipients: freshReminder.length,
    };

    if (dryRun) {
      return new Response(
        JSON.stringify({ dry_run: true, ...baseReport }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    let realEnqueued = 0;
    if (freshReal.length > 0) {
      const emailJobs = freshReal.map((a) => ({
        idempotency_key: `client-need:${body.client_need_id}:${a.agent_id}`,
        payload: {
          provider: "resend",
          template: "buyer-alert",
          to: a.email,
          subject: `New buyer looking in ${countyName}`,
          metadata: { audience: "agent", reason: a.reason, client_need_id: body.client_need_id },
          variables: {
            agentName: a.first_name || "Agent",
            location: countyName,
            propertyType: propertyTypeDisplay,
            maxPrice: `$${parseFloat(String(body.maxPrice)).toLocaleString()}`,
            bedrooms: body.bedrooms,
            bathrooms: body.bathrooms,
            description: body.description,
          },
        },
      }));
      await supabase.from("email_jobs").insert(emailJobs);
      await supabase.from("agent_sent_client_needs").upsert(
        freshReal.map((r) => ({
          agent_id: r.agent_id,
          client_need_id: body.client_need_id,
          reason: r.reason,
        })),
        { onConflict: "agent_id,client_need_id" },
      );
      realEnqueued = emailJobs.length;
    }

    let reminderEnqueued = 0;
    let reminderConflict = 0;
    for (const a of partition.reminder) {
      const res = await reserveAndEnqueueMissingOpportunityReminder(supabase, {
        agent_id: a.agent_id,
        event_type: "client_need_county",
        event_id: body.client_need_id,
        email: a.email,
        firstName: a.first_name,
      });
      if (res.queued) reminderEnqueued++;
      else if (!res.reserved) reminderConflict++;
      else if (res.error) console.error("[notify-agents] reminder RPC error:", res.error);
    }

    console.log(
      `[notify-agents] client_need=${body.client_need_id} audience=${audience.length} real=${realEnqueued} reminder=${reminderEnqueued}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        ...baseReport,
        real_enqueued: realEnqueued,
        reminder_enqueued: reminderEnqueued,
        reminder_skipped_duplicate: reminderConflict,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[notify-agents] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});