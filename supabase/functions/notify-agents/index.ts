import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter (resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const checkRateLimit = (userId: string, maxRequests = 5, windowMs = 60000): boolean => {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (userLimit.count >= maxRequests) {
    return false;
  }

  userLimit.count++;
  return true;
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting check (5 requests per minute)
    if (!checkRateLimit(user.id, 5, 60000)) {
      console.warn(`Rate limit exceeded for user ${user.id}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { countyId, propertyType, maxPrice, bedrooms, bathrooms, description }: BuyerNeedRequest = await req.json();

    // Validate inputs
    if (!countyId || typeof countyId !== "string" || countyId.length > 100) {
      throw new Error("Invalid county ID");
    }
    if (!propertyType || typeof propertyType !== "string" || propertyType.length > 50) {
      throw new Error("Invalid property type");
    }
    if (!maxPrice || typeof maxPrice !== "string" || !/^\d+(\.\d{1,2})?$/.test(maxPrice)) {
      throw new Error("Invalid max price");
    }
    if (description && (typeof description !== "string" || description.length > 2000)) {
      throw new Error("Description too long");
    }

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

    // Send email notifications to agents
    const countyName = `${county.name}, ${county.state}`;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    console.log(`Sending notifications to ${agentsToNotify.length} agents`);
    
    const emailPromises = agentsToNotify.map(async (agent: any) => {
      const profile = agent.agent_profiles;
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "AAC Worldwide <onboarding@resend.dev>",
            to: [profile.email],
            subject: `New buyer looking in ${countyName}`,
            html: `
              <h2>New Buyer Alert</h2>
              <p>Hi ${profile.first_name},</p>
              <p>A new buyer is looking for properties in <strong>${countyName}</strong>, one of your preferred areas!</p>
              
              <h3>Buyer Requirements:</h3>
              <ul>
                <li><strong>Property Type:</strong> ${propertyTypeDisplay}</li>
                <li><strong>Maximum Price:</strong> $${parseFloat(maxPrice).toLocaleString()}</li>
                ${bedrooms ? `<li><strong>Bedrooms:</strong> ${bedrooms}+</li>` : ""}
                ${bathrooms ? `<li><strong>Bathrooms:</strong> ${bathrooms}+</li>` : ""}
              </ul>
              
              ${description ? `<h3>Additional Details:</h3><p>${description}</p>` : ""}
              
              <p>Log in to your dashboard to view more details and connect with this buyer.</p>
              
              <p>Best regards,<br>Your Real Estate Platform</p>
            `,
          }),
        });
        
        const data = await emailResponse.json();
        console.log(`Email sent to ${profile.email}:`, data);
        
        return {
          email: profile.email,
          name: `${profile.first_name} ${profile.last_name}`,
          notified: true,
        };
      } catch (error) {
        console.error(`Failed to send email to ${profile.email}:`, error);
        return {
          email: profile.email,
          name: `${profile.first_name} ${profile.last_name}`,
          notified: false,
        };
      }
    });
    
    const results = await Promise.all(emailPromises);

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
