import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendNotificationRequest {
  category: "buyer_need" | "sales_intel" | "renter_need" | "general_discussion";
  subject: string;
  message: string;
  previewOnly?: boolean;
  criteria?: {
    state?: string;
    counties?: string[];
    cities?: string[];
    neighborhoods?: string[];
    minPrice?: number;
    maxPrice?: number;
    propertyTypes?: string[];
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { category, subject, message, criteria, previewOnly }: SendNotificationRequest = await req.json();

    console.log(`Sending ${category} notification from user ${user.id}`, criteria ? `with criteria: ${JSON.stringify(criteria)}` : "");

    // Get sender's profile information
    const { data: senderProfile, error: senderError } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name, email, company")
      .eq("id", user.id)
      .single();

    if (senderError) {
      console.error("Error fetching sender profile:", senderError);
    }

    const senderName = senderProfile 
      ? `${senderProfile.first_name} ${senderProfile.last_name}`
      : "An Agent";
    const senderEmail = senderProfile?.email || user.email;
    const senderCompany = senderProfile?.company || "";

    // Query for agents who have this notification preference enabled
    let query = supabase
      .from("notification_preferences")
      .select(`
        user_id,
        ${category}
      `)
      .eq(category, true);

    // Filter by state, property type, and price preferences if criteria provided
    if (criteria && criteria.state) {
      // Get agent profiles first to have their IDs
      const { data: allPrefs } = await query;
      
      if (!allPrefs || allPrefs.length === 0) {
        console.log("No agents found with notification preference enabled");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "No agents found with this notification preference enabled",
            recipientCount: 0 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const agentIds = allPrefs.map(p => p.user_id);
      console.log(`Initial agents with ${category} enabled: ${agentIds.length}`);

      // Filter by detailed geographic preferences using agent_buyer_coverage_areas
      let matchingAgentIds = agentIds;
      if (criteria.state || criteria.cities || criteria.counties || criteria.neighborhoods) {
        let geoQuery = supabase
          .from("agent_buyer_coverage_areas")
          .select("agent_id")
          .in("agent_id", agentIds);

        // Filter by state
        if (criteria.state) {
          geoQuery = geoQuery.eq("state", criteria.state);
        }

        // Filter by counties if provided
        if (criteria.counties && criteria.counties.length > 0) {
          geoQuery = geoQuery.in("county", criteria.counties);
        }

        // Filter by cities if provided
        if (criteria.cities && criteria.cities.length > 0) {
          geoQuery = geoQuery.in("city", criteria.cities);
        }

        // Filter by neighborhoods if provided
        if (criteria.neighborhoods && criteria.neighborhoods.length > 0) {
          geoQuery = geoQuery.in("neighborhood", criteria.neighborhoods);
        }

        const { data: geoPrefs, error: geoError } = await geoQuery;

        if (geoError) {
          console.error("Error fetching geographic preferences:", geoError);
        } else if (geoPrefs && geoPrefs.length > 0) {
          // Get unique agent IDs
          matchingAgentIds = [...new Set(geoPrefs.map(p => p.agent_id))];
          console.log(`After geographic filtering: ${matchingAgentIds.length} agents`);
        } else {
          console.log("No agents found matching geographic criteria");
          matchingAgentIds = [];
        }
      }

      // Filter by price preferences if provided
      if ((criteria.minPrice || criteria.maxPrice) && matchingAgentIds.length > 0) {
        const { data: pricePrefs, error: priceError } = await supabase
          .from("notification_preferences")
          .select("user_id, min_price, max_price")
          .in("user_id", matchingAgentIds);

        if (priceError) {
          console.error("Error fetching price preferences:", priceError);
        } else if (pricePrefs && pricePrefs.length > 0) {
          matchingAgentIds = pricePrefs
            .filter(pref => {
              const criteriaMin = criteria.minPrice || 0;
              const criteriaMax = criteria.maxPrice || Infinity;
              const prefMin = pref.min_price || 0;
              const prefMax = pref.max_price || Infinity;
              
              return prefMin <= criteriaMax && prefMax >= criteriaMin;
            })
            .map(p => p.user_id);
          
          console.log(`After price filtering: ${matchingAgentIds.length} agents`);
        }
      }

      // Filter by property types if provided
      if (criteria.propertyTypes && criteria.propertyTypes.length > 0 && matchingAgentIds.length > 0) {
        const { data: propertyTypePrefs, error: propertyTypeError } = await supabase
          .from("notification_preferences")
          .select("user_id, property_types")
          .in("user_id", matchingAgentIds);

        if (propertyTypeError) {
          console.error("Error fetching property type preferences:", propertyTypeError);
        } else if (propertyTypePrefs && propertyTypePrefs.length > 0) {
          matchingAgentIds = propertyTypePrefs
            .filter(pref => {
              const agentTypes = (pref.property_types as string[]) || [];
              // Agent must have at least one matching property type
              return criteria.propertyTypes!.some(type => agentTypes.includes(type));
            })
            .map(p => p.user_id);
          
          console.log(`After property type filtering: ${matchingAgentIds.length} agents`);
        }
      }

      if (matchingAgentIds.length === 0) {
        console.log("No agents match all criteria");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "No agents found matching all criteria",
            recipientCount: 0 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Final matching agent IDs
      query = supabase
        .from("notification_preferences")
        .select("user_id")
        .in("user_id", matchingAgentIds);
    }

    const { data: recipients, error: recipientsError } = await query;

    if (recipientsError) {
      console.error("Error fetching recipients:", recipientsError);
      throw new Error("Failed to fetch recipients");
    }

    if (!recipients || recipients.length === 0) {
      console.log("No matching recipients found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No agents found matching your criteria",
          recipientCount: 0 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If preview only, return the count
    if (previewOnly) {
      console.log(`Preview mode: Found ${recipients.length} potential recipients`);
      return new Response(
        JSON.stringify({ 
          success: true,
          recipientCount: recipients.length
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get full agent profiles for recipients
    const agentIds = recipients.map(r => r.user_id);
    const { data: agentProfiles, error: profileError } = await supabase
      .from("agent_profiles")
      .select("id, email, first_name, last_name")
      .in("id", agentIds);

    if (profileError || !agentProfiles) {
      console.error("Error fetching agent profiles:", profileError);
      throw new Error("Failed to fetch agent profiles");
    }

    // Build criteria summary for email
    let criteriaText = "";
    if (criteria) {
      if (criteria.state) {
        criteriaText += `<strong>State:</strong> ${criteria.state}<br>`;
      }
      if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
        criteriaText += `<strong>Property Types:</strong> ${criteria.propertyTypes.join(', ')}<br>`;
      }
      if (criteria.minPrice) {
        criteriaText += `<strong>Min Price:</strong> $${criteria.minPrice.toLocaleString()}<br>`;
      }
      if (criteria.maxPrice) {
        criteriaText += `<strong>Max Price:</strong> $${criteria.maxPrice.toLocaleString()}<br>`;
      }
    }

    // Send emails to all matching agents
    const emailResults = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    const getCategoryLabel = (cat: string) => {
      switch (cat) {
        case "buyer_need": return "Buyer Need";
        case "renter_need": return "Renter Need";
        case "sales_intel": return "Sales Intel";
        case "general_discussion": return "General Discussion";
        default: return cat;
      }
    };

    for (const agent of agentProfiles) {
      try {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${subject}</h2>
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
              <strong>From:</strong> ${senderName}${senderCompany ? ` (${senderCompany})` : ""}<br>
              <strong>Category:</strong> ${getCategoryLabel(category)}
            </p>
            
            ${criteriaText ? `
              <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #333;">Request Criteria</h3>
                ${criteriaText}
              </div>
            ` : ""}
            
            <div style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
              <p style="white-space: pre-wrap; color: #333;">${message}</p>
            </div>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              You received this email because you opted into ${getCategoryLabel(category)} notifications. You can manage your notification preferences in your dashboard.
            </p>
          </div>
        `;

        await resend.emails.send({
          from: "AgentConnect <notifications@agentconnect.ai>",
          to: agent.email,
          subject: `[${getCategoryLabel(category)}] ${subject}`,
          html,
          reply_to: senderEmail,
        });

        emailResults.sent++;
        console.log(`Email sent successfully to ${agent.email}`);
      } catch (error: any) {
        emailResults.failed++;
        const errorMsg = `Failed to send to ${agent.email}: ${error.message}`;
        emailResults.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    console.log(`Email campaign completed: ${emailResults.sent} sent, ${emailResults.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully sent ${emailResults.sent} email${emailResults.sent !== 1 ? 's' : ''}`,
        sent: emailResults.sent,
        failed: emailResults.failed,
        errors: emailResults.errors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-client-need-notification:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
