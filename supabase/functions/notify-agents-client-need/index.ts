import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  getVerifiedAgentAudience,
  classifyRecipients,
} from "../_shared/verifiedAgentAudience.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  client_need_id: string;
  // Optional overrides — otherwise loaded from client_needs row
  state?: string;
  city?: string;
  property_type?: string;
  max_price?: number;
  bedrooms?: number;
  bathrooms?: number;
  description?: string;
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  single_family: "Single Family",
  condo: "Condo",
  townhouse: "Townhouse",
  multi_family: "Multi-Family",
  land: "Land",
  commercial: "Commercial",
  residential_rental: "Residential Rental",
  commercial_rental: "Commercial Rental",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: Payload = await req.json();
    if (!body?.client_need_id) {
      throw new Error("client_need_id is required");
    }

    // Load canonical event
    const { data: need, error: needErr } = await supabase
      .from("client_needs")
      .select("*")
      .eq("id", body.client_need_id)
      .single();
    if (needErr || !need) throw new Error(`client_need not found: ${needErr?.message}`);

    const state: string = body.state ?? need.state;
    const city: string = body.city ?? need.city;
    const propertyType: string = body.property_type ?? need.property_type;
    const maxPrice: number = Number(body.max_price ?? need.max_price ?? 0);
    const bedrooms = body.bedrooms ?? need.bedrooms ?? null;
    const bathrooms = body.bathrooms ?? need.bathrooms ?? null;
    const description = body.description ?? need.description ?? null;
    const senderId: string | null = need.submitted_by ?? null;

    // Canonical audience
    const audience = await getVerifiedAgentAudience(supabase);
    if (!audience.length) {
      return new Response(JSON.stringify({ notified_count: 0, matched: 0, fallback: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Preference match set: state matches
    const { data: statePrefs } = await supabase
      .from("agent_state_preferences")
      .select("agent_id")
      .eq("state", state)
      .in("agent_id", audience.map((a) => a.agent_id));
    const matchIds = new Set((statePrefs || []).map((r: any) => r.agent_id));

    // Explicit opt-out honored authoritatively
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
      senderId,
      optedOut,
    );

    // Dedup against durable table
    const { data: alreadySent } = await supabase
      .from("agent_sent_client_needs")
      .select("agent_id")
      .eq("client_need_id", body.client_need_id)
      .in("agent_id", recipients.map((r) => r.agent_id));
    const sentSet = new Set((alreadySent || []).map((r: any) => r.agent_id));
    const fresh = recipients.filter((r) => !sentSet.has(r.agent_id));

    if (!fresh.length) {
      return new Response(
        JSON.stringify({
          notified_count: 0,
          matched: 0,
          fallback: 0,
          duplicates_skipped: recipients.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const propertyTypeDisplay = PROPERTY_TYPE_MAP[propertyType] || propertyType;
    const priceFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(maxPrice);

    const emailJobs = fresh.map((a) => ({
      idempotency_key: `client-need:${body.client_need_id}:${a.agent_id}`,
      payload: {
        provider: "resend",
        template: "client-need-notification",
        to: a.email,
        subject: `New Client Need in ${city}, ${state}`,
        metadata: { audience: "agent", reason: a.reason, client_need_id: body.client_need_id },
        variables: {
          agentName: a.first_name || "Agent",
          city, state,
          propertyType: propertyTypeDisplay,
          maxPrice: priceFormatted,
          bedrooms, bathrooms, description,
          contentHtml: `
            <h3>Client Need Details:</h3>
            <ul>
              <li><strong>Location:</strong> ${city}, ${state}</li>
              <li><strong>Property Type:</strong> ${propertyTypeDisplay}</li>
              <li><strong>Maximum Budget:</strong> ${priceFormatted}</li>
              ${bedrooms ? `<li><strong>Bedrooms:</strong> ${bedrooms}</li>` : ""}
              ${bathrooms ? `<li><strong>Bathrooms:</strong> ${bathrooms}</li>` : ""}
              ${description ? `<li><strong>Description:</strong> ${description}</li>` : ""}
            </ul>
            <p>Log in to your dashboard to view more details and connect with this client.</p>
          `,
        },
      },
    }));

    const { error: insertError } = await supabase.from("email_jobs").insert(emailJobs);
    if (insertError) throw insertError;

    await supabase.from("agent_sent_client_needs").upsert(
      fresh.map((r) => ({
        agent_id: r.agent_id,
        client_need_id: body.client_need_id,
        reason: r.reason,
      })),
      { onConflict: "agent_id,client_need_id" },
    );

    const matched = fresh.filter((r) => r.reason === "preferences_match").length;
    const fallback = fresh.filter((r) => r.reason === "preferences_unset").length;

    console.log(
      `[notify-agents-client-need] client_need=${body.client_need_id} audience=${audience.length} matched=${matched} fallback=${fallback} sender_excluded=${senderId ? 1 : 0} opted_out=${optedOut.size} duplicates_skipped=${recipients.length - fresh.length}`,
    );

    return new Response(
      JSON.stringify({
        notified_count: fresh.length,
        matched,
        fallback,
        duplicates_skipped: recipients.length - fresh.length,
        opted_out: optedOut.size,
        audience: audience.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[notify-agents-client-need] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});