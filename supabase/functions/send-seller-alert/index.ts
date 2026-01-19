import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SellerAlertRequest {
  submission_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { submission_id }: SellerAlertRequest = await req.json();

    if (!submission_id) {
      throw new Error("submission_id is required");
    }

    // 1. Load the submission
    const { data: submission, error: subError } = await supabase
      .from("agent_match_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (subError || !submission) {
      throw new Error(`Submission not found: ${subError?.message}`);
    }

    // 2. Find matching hot sheets (same logic as count_matching_agents)
    const { data: hotSheets, error: hsError } = await supabase
      .from("hot_sheets")
      .select(`
        id,
        name,
        user_id,
        criteria
      `)
      .eq("is_active", true);

    if (hsError) {
      throw new Error(`Failed to fetch hot sheets: ${hsError.message}`);
    }

    // 3. Get AAC Verified agents
    const { data: verifiedAgents, error: vaError } = await supabase
      .from("agent_settings")
      .select("user_id")
      .eq("agent_status", "verified");

    if (vaError) {
      throw new Error(`Failed to fetch verified agents: ${vaError.message}`);
    }

    const verifiedAgentIds = new Set(verifiedAgents?.map((a) => a.user_id) || []);

    // 4. Filter hot sheets to verified agents and matching criteria
    const matchingHotSheets = (hotSheets || []).filter((hs) => {
      // Must be a verified agent
      if (!verifiedAgentIds.has(hs.user_id)) return false;

      const criteria = hs.criteria || {};

      // City match (if specified in hot sheet)
      if (criteria.cities && Array.isArray(criteria.cities) && criteria.cities.length > 0) {
        if (!criteria.cities.includes(submission.city)) return false;
      }

      // State match (if specified)
      if (criteria.state && criteria.state.toLowerCase() !== submission.state?.toLowerCase()) {
        return false;
      }

      // Property type match (if specified)
      if (criteria.propertyTypes && Array.isArray(criteria.propertyTypes) && criteria.propertyTypes.length > 0) {
        if (!criteria.propertyTypes.includes(submission.property_type)) return false;
      }

      // Price within range
      const price = parseFloat(submission.asking_price) || 0;
      if (criteria.minPrice && price < parseFloat(criteria.minPrice)) return false;
      if (criteria.maxPrice && price > parseFloat(criteria.maxPrice)) return false;

      // Beds minimum
      if (criteria.bedrooms && (submission.bedrooms || 0) < parseInt(criteria.bedrooms)) {
        return false;
      }

      // Baths minimum
      if (criteria.bathrooms && (submission.bathrooms || 0) < parseFloat(criteria.bathrooms)) {
        return false;
      }

      return true;
    });

    // 5. Group by agent_id (avoid duplicate emails)
    const agentHotSheetMap = new Map<string, { hotSheetIds: string[]; hotSheetNames: string[] }>();
    
    for (const hs of matchingHotSheets) {
      const existing = agentHotSheetMap.get(hs.user_id);
      if (existing) {
        existing.hotSheetIds.push(hs.id);
        existing.hotSheetNames.push(hs.name);
      } else {
        agentHotSheetMap.set(hs.user_id, {
          hotSheetIds: [hs.id],
          hotSheetNames: [hs.name],
        });
      }
    }

    // 6. Get agent profiles for email addresses
    const agentIds = Array.from(agentHotSheetMap.keys());
    
    if (agentIds.length === 0) {
      console.log("No matching agents found for submission:", submission_id);
      return new Response(
        JSON.stringify({ success: true, agentsNotified: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: agentProfiles, error: apError } = await supabase
      .from("agent_profiles")
      .select("id, email, first_name, last_name")
      .in("id", agentIds);

    if (apError) {
      throw new Error(`Failed to fetch agent profiles: ${apError.message}`);
    }

    // 7. Send emails and create delivery records
    let agentsNotified = 0;
    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://allagentconnect.lovable.app";

    for (const profile of agentProfiles || []) {
      const agentData = agentHotSheetMap.get(profile.id);
      if (!agentData) continue;

      // Check if already notified (via deliveries table)
      const { data: existingDelivery } = await supabase
        .from("agent_match_deliveries")
        .select("id, notified_agent_at")
        .eq("submission_id", submission_id)
        .eq("agent_id", profile.id)
        .maybeSingle();

      if (existingDelivery?.notified_agent_at) {
        console.log(`Agent ${profile.id} already notified for submission ${submission_id}`);
        continue;
      }

      // Create or update delivery record for each matching hot sheet
      for (const hsId of agentData.hotSheetIds) {
        await supabase
          .from("agent_match_deliveries")
          .upsert(
            {
              submission_id,
              agent_id: profile.id,
              hot_sheet_id: hsId,
            },
            { onConflict: "submission_id,agent_id,hot_sheet_id" }
          );
      }

      // Format property details
      const location = [submission.neighborhood, submission.city, submission.state]
        .filter(Boolean)
        .join(", ");
      const priceFormatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(parseFloat(submission.asking_price) || 0);

      const contactMethodLabel =
        submission.preferred_contact_method === "text"
          ? "Text message"
          : submission.preferred_contact_method === "phone"
          ? "Phone call"
          : "Email";

      const contactInfo =
        submission.preferred_contact_method === "email"
          ? submission.seller_email
          : submission.seller_phone || submission.seller_email;

      const detailsUrl = `${baseUrl}/seller-listing/${submission_id}`;

      // Send email
      try {
        await resend.emails.send({
          from: "AllAgentConnect <mail@mail.allagentconnect.com>",
          to: [profile.email],
          replyTo: submission.seller_email,
          subject: `Seller Alert: Home matches your Hot Sheet`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <p style="color: #0F172A; font-weight: 600; font-size: 18px; margin-bottom: 4px;">AllAgentConnect</p>
              
              <h1 style="color: #0F172A; font-size: 24px; margin: 24px 0 16px;">
                A seller has a home that matches your Hot Sheet
              </h1>
              
              <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                Hi ${profile.first_name || "Agent"},
              </p>
              
              <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">
                A seller has submitted a property that matches your Hot Sheet criteria. Here are the details:
              </p>
              
              <div style="background: #F8FAFC; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #0F172A; font-weight: 600; font-size: 16px; margin: 0 0 12px;">📍 ${location}</p>
                <p style="color: #475569; font-size: 14px; margin: 0 0 8px;">
                  🏠 ${submission.property_type} • ${submission.bedrooms} bed • ${submission.bathrooms} bath
                </p>
                <p style="color: #475569; font-size: 14px; margin: 0 0 8px;">
                  📐 ${submission.square_feet?.toLocaleString()} sqft
                </p>
                <p style="color: #0F172A; font-weight: 600; font-size: 18px; margin: 12px 0 8px;">
                  💰 Asking: ${priceFormatted}
                </p>
                <p style="color: #475569; font-size: 14px; margin: 0;">
                  💵 Buyer Agent Commission: ${submission.buyer_agent_commission || "Contact seller"}
                </p>
              </div>
              
              <div style="background: #EFF6FF; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #BFDBFE;">
                <p style="color: #0F172A; font-weight: 600; font-size: 14px; margin: 0 0 8px;">Preferred Contact Method: ${contactMethodLabel}</p>
                <p style="color: #0F172A; font-size: 16px; margin: 0;">
                  ${submission.seller_name ? `<strong>${submission.seller_name}</strong><br/>` : ""}
                  ${contactInfo}
                </p>
              </div>
              
              <a href="${detailsUrl}" style="display: inline-block; background: #0F172A; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 16px;">
                View Property Details
              </a>
              
              <p style="color: #64748B; font-size: 12px; margin-top: 32px;">
                AllAgentConnect mail.allagentconnect.com
              </p>
            </div>
          `,
        });

        // Mark as notified
        await supabase
          .from("agent_match_deliveries")
          .update({ notified_agent_at: new Date().toISOString() })
          .eq("submission_id", submission_id)
          .eq("agent_id", profile.id);

        agentsNotified++;
        console.log(`Seller Alert sent to agent ${profile.id} (${profile.email})`);
      } catch (emailError) {
        console.error(`Failed to send email to ${profile.email}:`, emailError);
      }
    }

    console.log(`Seller Alert complete: ${agentsNotified} agents notified for submission ${submission_id}`);

    return new Response(
      JSON.stringify({ success: true, agentsNotified }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-seller-alert:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
