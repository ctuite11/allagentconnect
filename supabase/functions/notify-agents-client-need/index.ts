import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClientNeedData {
  client_need_id: string;
  state: string;
  city: string;
  property_type: string;
  max_price: number;
  bedrooms?: number;
  bathrooms?: number;
  description?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== Notify Agents Client Need Function Started ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const clientNeedData: ClientNeedData = await req.json();
    console.log("Client need data:", clientNeedData);

    // Find agents who cover this state and have notifications enabled
    const { data: agentPreferences, error: prefsError } = await supabase
      .from("agent_state_preferences")
      .select("agent_id")
      .eq("state", clientNeedData.state);

    if (prefsError) {
      console.error("Error fetching agent preferences:", prefsError);
      throw prefsError;
    }

    if (!agentPreferences || agentPreferences.length === 0) {
      console.log("No agents found covering state:", clientNeedData.state);
      return new Response(
        JSON.stringify({ message: "No matching agents found", notified_count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const agentIds = agentPreferences.map((p: any) => p.agent_id);

    // Get agent profiles with email and notification preferences
    const { data: agents, error: agentsError } = await supabase
      .from("agent_profiles")
      .select("id, email, first_name, last_name, receive_buyer_alerts")
      .in("id", agentIds)
      .eq("receive_buyer_alerts", true);

    if (agentsError) {
      console.error("Error fetching agent profiles:", agentsError);
      throw agentsError;
    }

    if (!agents || agents.length === 0) {
      console.log("No agents with notifications enabled");
      return new Response(
        JSON.stringify({ message: "No agents with notifications enabled", notified_count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[notify-agents-client-need] Enqueuing ${agents.length} jobs`);

    // Format property type for display
    const propertyTypeMap: Record<string, string> = {
      single_family: "Single Family",
      condo: "Condo",
      townhouse: "Townhouse",
      multi_family: "Multi-Family",
      land: "Land",
      commercial: "Commercial",
      residential_rental: "Residential Rental",
      commercial_rental: "Commercial Rental",
    };
    const propertyTypeDisplay = propertyTypeMap[clientNeedData.property_type] || clientNeedData.property_type;

    // Format price
    const priceFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(clientNeedData.max_price);

    // Enqueue jobs for each agent
    const emailJobs = agents.map((agent: any) => ({
      payload: {
        provider: "resend",
        template: "client-need-notification",
        to: agent.email,
        subject: `New Client Need in ${clientNeedData.city}, ${clientNeedData.state}`,
        variables: {
          agentName: agent.first_name || 'Agent',
          city: clientNeedData.city,
          state: clientNeedData.state,
          propertyType: propertyTypeDisplay,
          maxPrice: priceFormatted,
          bedrooms: clientNeedData.bedrooms,
          bathrooms: clientNeedData.bathrooms,
          description: clientNeedData.description,
          contentHtml: `
            <h3>Client Need Details:</h3>
            <ul>
              <li><strong>Location:</strong> ${clientNeedData.city}, ${clientNeedData.state}</li>
              <li><strong>Property Type:</strong> ${propertyTypeDisplay}</li>
              <li><strong>Maximum Budget:</strong> ${priceFormatted}</li>
              ${clientNeedData.bedrooms ? `<li><strong>Bedrooms:</strong> ${clientNeedData.bedrooms}</li>` : ''}
              ${clientNeedData.bathrooms ? `<li><strong>Bathrooms:</strong> ${clientNeedData.bathrooms}</li>` : ''}
              ${clientNeedData.description ? `<li><strong>Description:</strong> ${clientNeedData.description}</li>` : ''}
            </ul>
            <p>Log in to your dashboard to view more details and connect with this client.</p>
          `,
        },
      },
    }));

    const { error: insertError } = await supabase.from("email_jobs").insert(emailJobs);

    if (insertError) {
      console.error("[notify-agents-client-need] Failed to enqueue jobs:", insertError);
      throw new Error("Failed to queue emails");
    }

    console.log(`[notify-agents-client-need] Successfully enqueued ${emailJobs.length} jobs`);

    return new Response(
      JSON.stringify({ 
        message: "Notifications queued", 
        queued: emailJobs.length,
        total_agents: agents.length
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-agents-client-need function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);