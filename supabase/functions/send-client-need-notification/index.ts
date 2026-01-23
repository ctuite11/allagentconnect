import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendNotificationRequest {
  category: "buyer_need" | "sales_intel" | "renter_need" | "general_discussion";
  subject: string;
  message: string;
  previewOnly?: boolean;
  sendCopyToSelf?: boolean;
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

const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const getCategoryLabel = (cat: string) => {
  switch (cat) {
    case "buyer_need": return "Buyer Need";
    case "renter_need": return "Renter Need";
    case "sales_intel": return "Sales Intel";
    case "general_discussion": return "General Discussion";
    default: return cat;
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { category, subject, message, criteria, previewOnly, sendCopyToSelf }: SendNotificationRequest = await req.json();

    // Get sender's profile
    const { data: senderProfile } = await supabase
      .from("agent_profiles")
      .select("first_name, last_name, email, company")
      .eq("id", user.id)
      .single();

    const senderName = senderProfile ? `${senderProfile.first_name} ${senderProfile.last_name}` : "An Agent";
    const senderEmail = senderProfile?.email || user.email;
    const senderCompany = senderProfile?.company || "";
    const validReplyTo = senderEmail && isValidEmail(senderEmail) ? senderEmail : undefined;

    // Query for agents with this notification preference enabled
    let query = supabase.from("notification_preferences").select("user_id").eq(category, true);

    // Apply criteria filters if provided
    if (criteria?.state) {
      const { data: allPrefs } = await query;
      if (!allPrefs?.length) {
        return new Response(
          JSON.stringify({ success: true, message: "No agents found", recipientCount: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let matchingAgentIds = allPrefs.map(p => p.user_id);

      // Geographic filtering
      if (criteria.state || criteria.cities?.length || criteria.counties?.length) {
        const { data: geoPrefs } = await supabase
          .from("agent_buyer_coverage_areas")
          .select("agent_id")
          .in("agent_id", matchingAgentIds)
          .eq("state", criteria.state);

        matchingAgentIds = [...new Set(geoPrefs?.map(p => p.agent_id) || [])];
      }

      // Price filtering
      if ((criteria.minPrice || criteria.maxPrice) && matchingAgentIds.length > 0) {
        const { data: pricePrefs } = await supabase
          .from("notification_preferences")
          .select("user_id, min_price, max_price")
          .in("user_id", matchingAgentIds);

        matchingAgentIds = (pricePrefs || [])
          .filter(pref => {
            const criteriaMin = criteria.minPrice || 0;
            const criteriaMax = criteria.maxPrice || Infinity;
            return (pref.min_price || 0) <= criteriaMax && (pref.max_price || Infinity) >= criteriaMin;
          })
          .map(p => p.user_id);
      }

      if (matchingAgentIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No agents match criteria", recipientCount: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      query = supabase.from("notification_preferences").select("user_id").in("user_id", matchingAgentIds);
    }

    const { data: recipients } = await query;

    if (!recipients?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No matching recipients", recipientCount: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (previewOnly) {
      return new Response(
        JSON.stringify({ success: true, recipientCount: recipients.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get agent profiles
    const agentIds = recipients.map(r => r.user_id);
    const { data: agentProfiles } = await supabase
      .from("agent_profiles")
      .select("id, email, first_name, last_name")
      .in("id", agentIds);

    if (!agentProfiles?.length) {
      throw new Error("Failed to fetch agent profiles");
    }

    // Build criteria text
    let criteriaText = "";
    if (criteria) {
      if (criteria.state) criteriaText += `<strong>State:</strong> ${criteria.state}<br>`;
      if (criteria.propertyTypes?.length) criteriaText += `<strong>Property Types:</strong> ${criteria.propertyTypes.join(', ')}<br>`;
      if (criteria.minPrice) criteriaText += `<strong>Min Price:</strong> $${criteria.minPrice.toLocaleString()}<br>`;
      if (criteria.maxPrice) criteriaText += `<strong>Max Price:</strong> $${criteria.maxPrice.toLocaleString()}<br>`;
    }

    console.log(`[send-client-need-notification] Enqueuing ${agentProfiles.length} jobs`);

    // Enqueue jobs
    const emailJobs: Array<{ payload: Record<string, any> }> = agentProfiles.map(agent => ({
      payload: {
        provider: "resend",
        template: "client-need-broadcast",
        to: agent.email,
        subject: `[${getCategoryLabel(category)}] ${subject}`,
        reply_to: validReplyTo,
        variables: {
          agentName: agent.first_name,
          senderName,
          senderCompany,
          category: getCategoryLabel(category),
          subject,
          message,
          criteriaText,
          contentHtml: `
            <h2>${subject}</h2>
            <p><strong>From:</strong> ${senderName}${senderCompany ? ` (${senderCompany})` : ""}</p>
            <p><strong>Category:</strong> ${getCategoryLabel(category)}</p>
            ${criteriaText ? `<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;"><h3>Request Criteria</h3>${criteriaText}</div>` : ""}
            <div style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
              <p style="white-space: pre-wrap;">${message}</p>
            </div>
          `,
        },
      },
    }));

    // Add sender copy if requested
    if (sendCopyToSelf && senderEmail && isValidEmail(senderEmail)) {
      emailJobs.push({
        payload: {
          provider: "resend",
          template: "client-need-broadcast",
          to: senderEmail,
          subject: `[COPY] [${getCategoryLabel(category)}] ${subject}`,
          reply_to: undefined,
          variables: {
            agentName: senderName,
            senderName,
            senderCompany,
            category: getCategoryLabel(category),
            subject,
            message,
            criteriaText,
            isCopy: true,
            recipientCount: agentProfiles.length,
            contentHtml: `
              <div style="background: #e0f2fe; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
                <p><strong>Copy of email sent to ${agentProfiles.length} recipients</strong></p>
              </div>
              <h2>${subject}</h2>
              <p><strong>Category:</strong> ${getCategoryLabel(category)}</p>
              ${criteriaText ? `<div style="background: #f5f5f5; padding: 15px; margin: 20px 0;">${criteriaText}</div>` : ""}
              <div style="padding: 20px; border: 1px solid #ddd;"><p style="white-space: pre-wrap;">${message}</p></div>
            `,
          },
        },
      });
    }

    const { error: insertError } = await supabase.from("email_jobs").insert(emailJobs);

    if (insertError) {
      console.error("[send-client-need-notification] Failed to enqueue:", insertError);
      throw new Error("Failed to queue emails");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Queued ${agentProfiles.length} emails`,
        queued: agentProfiles.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-client-need-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);