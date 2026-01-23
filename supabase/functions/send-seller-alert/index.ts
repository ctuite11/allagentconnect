import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SellerAlertRequest {
  submission_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://allagentconnect.lovable.app";

    const { submission_id }: SellerAlertRequest = await req.json();

    if (!submission_id) {
      throw new Error("submission_id is required");
    }

    // Load the submission
    const { data: submission, error: subError } = await supabase
      .from("agent_match_submissions")
      .select("*")
      .eq("id", submission_id)
      .single();

    if (subError || !submission) {
      throw new Error(`Submission not found: ${subError?.message}`);
    }

    // Find matching hot sheets
    const { data: hotSheets } = await supabase
      .from("hot_sheets")
      .select("id, name, user_id, criteria")
      .eq("is_active", true);

    // Get verified agents
    const { data: verifiedAgents } = await supabase
      .from("agent_settings")
      .select("user_id")
      .eq("agent_status", "verified");

    const verifiedAgentIds = new Set(verifiedAgents?.map((a) => a.user_id) || []);

    // Filter hot sheets to verified agents and matching criteria
    const matchingHotSheets = (hotSheets || []).filter((hs) => {
      if (!verifiedAgentIds.has(hs.user_id)) return false;
      const criteria = hs.criteria || {};
      
      if (criteria.cities?.length && !criteria.cities.includes(submission.city)) return false;
      if (criteria.state && criteria.state.toLowerCase() !== submission.state?.toLowerCase()) return false;
      if (criteria.propertyTypes?.length && !criteria.propertyTypes.includes(submission.property_type)) return false;
      
      const price = parseFloat(submission.asking_price) || 0;
      if (criteria.minPrice && price < parseFloat(criteria.minPrice)) return false;
      if (criteria.maxPrice && price > parseFloat(criteria.maxPrice)) return false;
      if (criteria.bedrooms && (submission.bedrooms || 0) < parseInt(criteria.bedrooms)) return false;
      if (criteria.bathrooms && (submission.bathrooms || 0) < parseFloat(criteria.bathrooms)) return false;
      
      return true;
    });

    // Group by agent
    const agentHotSheetMap = new Map<string, string[]>();
    for (const hs of matchingHotSheets) {
      const existing = agentHotSheetMap.get(hs.user_id) || [];
      existing.push(hs.id);
      agentHotSheetMap.set(hs.user_id, existing);
    }

    const agentIds = Array.from(agentHotSheetMap.keys());
    
    if (agentIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, agentsNotified: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get agent profiles
    const { data: agentProfiles } = await supabase
      .from("agent_profiles")
      .select("id, email, first_name, last_name")
      .in("id", agentIds);

    // Format price
    const priceFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(parseFloat(submission.asking_price) || 0);

    const locationWithNeighborhood = submission.neighborhood 
      ? `${submission.city}, ${submission.neighborhood}` 
      : submission.city;

    const detailsUrl = `${baseUrl}/seller-listing/${submission_id}`;

    console.log(`[send-seller-alert] Enqueuing ${agentProfiles?.length || 0} jobs`);

    // Build jobs for each agent
    const emailJobs = [];
    
    for (const profile of agentProfiles || []) {
      const hotSheetIds = agentHotSheetMap.get(profile.id) || [];

      // Check if already notified
      const { data: existingDelivery } = await supabase
        .from("agent_match_deliveries")
        .select("id, notified_agent_at")
        .eq("submission_id", submission_id)
        .eq("agent_id", profile.id)
        .maybeSingle();

      if (existingDelivery?.notified_agent_at) continue;

      // Create delivery records
      for (const hsId of hotSheetIds) {
        await supabase.from("agent_match_deliveries").upsert(
          { submission_id, agent_id: profile.id, hot_sheet_id: hsId },
          { onConflict: "submission_id,agent_id,hot_sheet_id" }
        );
      }

      // Build property snapshot
      const propertySnapshotLines = [
        `<li><strong>Location:</strong> ${locationWithNeighborhood}${submission.state ? `, ${submission.state}` : ""}</li>`,
        `<li><strong>Property type:</strong> ${submission.property_type}</li>`,
        `<li><strong>Beds / Baths:</strong> ${submission.bedrooms} / ${submission.bathrooms}</li>`,
        `<li><strong>Square feet:</strong> ${submission.square_feet?.toLocaleString() || "N/A"}</li>`,
        `<li><strong>Asking price:</strong> ${priceFormatted}</li>`,
      ];
      if (submission.buyer_agent_commission) {
        propertySnapshotLines.push(`<li><strong>Buyer agent commission:</strong> ${submission.buyer_agent_commission}</li>`);
      }

      const contactMethodLabel = submission.preferred_contact_method === "text" ? "Text message" 
        : submission.preferred_contact_method === "phone" ? "Phone call" : "Email";

      emailJobs.push({
        payload: {
          provider: "resend",
          template: "seller-alert",
          to: profile.email,
          subject: "Seller Alert: Home matches your active buyer needs",
          reply_to: submission.seller_email,
          variables: {
            agentName: profile.first_name || "Agent",
            propertyHtml: `<ul style="list-style: none; padding: 0;">${propertySnapshotLines.join("")}</ul>`,
            contactMethod: contactMethodLabel,
            viewLink: detailsUrl,
            submissionId: submission_id,
            contentHtml: `
              <p>Hi ${profile.first_name || "Agent"},</p>
              <p>A homeowner has submitted a private Seller Match listing that aligns with your active buyer criteria.</p>
              <div style="background: #F8FAFC; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <p style="font-weight: 600;">Property snapshot</p>
                <ul style="list-style: none; padding: 0;">${propertySnapshotLines.join("")}</ul>
              </div>
              <div style="background: #EFF6FF; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <p><strong>Preferred contact method:</strong> ${contactMethodLabel}</p>
              </div>
              <p><a href="${detailsUrl}" style="display: inline-block; background: #0F172A; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View Seller Match Listing →</a></p>
            `,
          },
        },
      });

      // Mark as notified
      await supabase
        .from("agent_match_deliveries")
        .update({ notified_agent_at: new Date().toISOString() })
        .eq("submission_id", submission_id)
        .eq("agent_id", profile.id);
    }

    if (emailJobs.length > 0) {
      const { error: insertError } = await supabase.from("email_jobs").insert(emailJobs);
      if (insertError) {
        console.error("[send-seller-alert] Failed to enqueue:", insertError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, agentsNotified: emailJobs.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[send-seller-alert] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);