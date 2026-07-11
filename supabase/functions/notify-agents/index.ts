import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import {
  getVerifiedAgentAudience,
  classifyRecipients,
} from "../_shared/verifiedAgentAudience.ts";

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

    // County lookup
    const { data: county } = await supabase
      .from("counties")
      .select("id, name, state")
      .eq("id", body.countyId)
      .single();
    if (!county) throw new Error("County not found");

    // Canonical audience
    const audience = await getVerifiedAgentAudience(supabase);

    // Match set: agent covers this county
    const { data: countyPrefs } = await supabase
      .from("agent_county_preferences")
      .select("agent_id")
      .eq("county_id", body.countyId)
      .in("agent_id", audience.map((a) => a.agent_id));
    const matchIds = new Set((countyPrefs || []).map((r: any) => r.agent_id));

    // Explicit opt-out (authoritative)
    const { data: optOutRows } = await supabase
      .from("agent_profiles")
      .select("id, receive_buyer_alerts")
      .in("id", audience.map((a) => a.agent_id));
    const optedOut = new Set<string>();
    for (const r of optOutRows || []) {
      if (r.receive_buyer_alerts === false) optedOut.add(r.id);
    }

    const recipients = classifyRecipients(
      audience,
      (a) => matchIds.has(a.agent_id),
      user.id,
      optedOut,
    );

    // Durable dedup
    const { data: alreadySent } = await supabase
      .from("agent_sent_client_needs")
      .select("agent_id")
      .eq("client_need_id", body.client_need_id)
      .in("agent_id", recipients.map((r) => r.agent_id));
    const sentSet = new Set((alreadySent || []).map((r: any) => r.agent_id));
    const fresh = recipients.filter((r) => !sentSet.has(r.agent_id));

    const propertyTypeDisplay = String(body.propertyType)
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const countyName = `${county.name}, ${county.state}`;

    if (fresh.length > 0) {
      const emailJobs = fresh.map((a) => ({
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
        fresh.map((r) => ({
          agent_id: r.agent_id,
          client_need_id: body.client_need_id,
          reason: r.reason,
        })),
        { onConflict: "agent_id,client_need_id" },
      );
    }

    const matched = fresh.filter((r) => r.reason === "preferences_match").length;
    const fallback = fresh.filter((r) => r.reason === "preferences_unset").length;

    console.log(
      `[notify-agents] client_need=${body.client_need_id} audience=${audience.length} matched=${matched} fallback=${fallback} opted_out=${optedOut.size} duplicates_skipped=${recipients.length - fresh.length}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        queued: fresh.length,
        matched,
        fallback,
        opted_out: optedOut.size,
        duplicates_skipped: recipients.length - fresh.length,
        audience: audience.length,
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