import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BuyerNeedRequest {
  countyId: string;
  propertyType: string;
  maxPrice: string;
  bedrooms?: string;
  bathrooms?: string;
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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: 5 requests per minute per user
    const { data: rateLimit } = await supabase.rpc('rate_limit_consume', {
      p_key: `route:notify-agents|user:${user.id}`,
      p_window_seconds: 60,
      p_limit: 5,
    });

    if (rateLimit && !rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { countyId, propertyType, maxPrice, bedrooms, bathrooms, description }: BuyerNeedRequest = await req.json();

    // Get county name
    const { data: county } = await supabase
      .from("counties")
      .select("name, state")
      .eq("id", countyId)
      .single();

    if (!county) {
      throw new Error("County not found");
    }

    // Find agents with alerts enabled
    const { data: matchingAgents } = await supabase
      .from("agent_county_preferences")
      .select(`agent_id, agent_profiles!inner (email, first_name, last_name, receive_buyer_alerts)`)
      .eq("county_id", countyId);

    const agentsToNotify = matchingAgents?.filter((a: any) => a.agent_profiles.receive_buyer_alerts) || [];

    console.log(`[notify-agents] Enqueuing ${agentsToNotify.length} jobs`);

    const propertyTypeDisplay = propertyType.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const countyName = `${county.name}, ${county.state}`;

    // Enqueue jobs
    const emailJobs = agentsToNotify.map((agent: any) => ({
      payload: {
        provider: "resend",
        template: "buyer-alert",
        to: agent.agent_profiles.email,
        subject: `New buyer looking in ${countyName}`,
        variables: {
          agentName: agent.agent_profiles.first_name,
          location: countyName,
          propertyType: propertyTypeDisplay,
          maxPrice: `$${parseFloat(maxPrice).toLocaleString()}`,
          bedrooms,
          bathrooms,
          description,
        },
      },
    }));

    if (emailJobs.length > 0) {
      await supabase.from("email_jobs").insert(emailJobs);
    }

    return new Response(
      JSON.stringify({ success: true, queued: emailJobs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[notify-agents] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});