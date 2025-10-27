import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { countyId, propertyType, maxPrice, bedrooms, bathrooms, description }: BuyerNeedRequest = await req.json();

    console.log("Processing buyer need notification for county:", countyId);

    // Get county name
    const { data: county } = await supabase
      .from("counties")
      .select("name, state")
      .eq("id", countyId)
      .single();

    if (!county) {
      throw new Error("County not found");
    }

    // Find agents who:
    // 1. Have opted into this county
    // 2. Have receive_buyer_alerts enabled
    const { data: matchingAgents, error: agentError } = await supabase
      .from("agent_county_preferences")
      .select(`
        agent_id,
        agent_profiles!inner (
          email,
          first_name,
          last_name,
          receive_buyer_alerts
        )
      `)
      .eq("county_id", countyId);

    if (agentError) {
      console.error("Error fetching agents:", agentError);
      throw agentError;
    }

    console.log(`Found ${matchingAgents?.length || 0} matching agents`);

    // Filter agents who have alerts enabled
    const agentsToNotify = matchingAgents?.filter(
      (agent: any) => agent.agent_profiles.receive_buyer_alerts
    ) || [];

    console.log(`Notifying ${agentsToNotify.length} agents`);

    // Format property type for display
    const propertyTypeDisplay = propertyType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    // Send notification to each agent (placeholder for now - will use Resend in next step)
    const notifications = agentsToNotify.map(async (agent: any) => {
      const profile = agent.agent_profiles;
      
      console.log(`Would notify ${profile.email} about:`, {
        propertyType: propertyTypeDisplay,
        county: `${county.name}, ${county.state}`,
        maxPrice: `$${parseFloat(maxPrice).toLocaleString()}`,
        bedrooms,
        bathrooms,
        description,
      });

      // TODO: Integrate with Resend to send actual emails
      return {
        email: profile.email,
        name: `${profile.first_name} ${profile.last_name}`,
        notified: true,
      };
    });

    const results = await Promise.all(notifications);

    return new Response(
      JSON.stringify({
        success: true,
        notifiedCount: results.length,
        agents: results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in notify-agents function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
