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
  criteria?: {
    state?: string;
    city?: string;
    minPrice?: number;
    maxPrice?: number;
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

    const { category, subject, message, criteria }: SendNotificationRequest = await req.json();

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

    // For buyer_need and renter_need, filter by geographic and price preferences if criteria provided
    if ((category === "buyer_need" || category === "renter_need") && criteria) {
      // Get agent profiles first to have their IDs, then filter by preferences
      const { data: allPrefs } = await query;
      
      if (!allPrefs || allPrefs.length === 0) {
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

      // Filter by geographic preferences if state is provided
      let matchingAgentIds = agentIds;
      if (criteria.state) {
        const { data: geoPrefs, error: geoError } = await supabase
          .from("agent_buyer_coverage_areas")
          .select("agent_id")
          .in("agent_id", agentIds)
          .eq("state", criteria.state);

        if (geoError) {
          console.error("Error fetching geographic preferences:", geoError);
        } else if (geoPrefs && geoPrefs.length > 0) {
          matchingAgentIds = geoPrefs.map(g => g.agent_id);
        } else {
          // No agents match the state criteria
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "No agents found covering the specified location",
              recipientCount: 0 
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Further filter by city if provided
        if (criteria.city && matchingAgentIds.length > 0) {
          const { data: cityPrefs } = await supabase
            .from("agent_buyer_coverage_areas")
            .select("agent_id")
            .in("agent_id", matchingAgentIds)
            .eq("city", criteria.city);

          if (cityPrefs && cityPrefs.length > 0) {
            matchingAgentIds = cityPrefs.map(c => c.agent_id);
          }
        }
      }

      // Filter by price preferences if provided
      if ((criteria.minPrice || criteria.maxPrice) && matchingAgentIds.length > 0) {
        let priceQuery = supabase
          .from("notification_preferences")
          .select("user_id")
          .in("user_id", matchingAgentIds);

        if (criteria.maxPrice) {
          priceQuery = priceQuery.or(`min_price.is.null,min_price.lte.${criteria.maxPrice}`);
        }
        if (criteria.minPrice) {
          priceQuery = priceQuery.or(`max_price.is.null,max_price.gte.${criteria.minPrice}`);
        }

        const { data: pricePrefs } = await priceQuery;
        if (pricePrefs && pricePrefs.length > 0) {
          matchingAgentIds = pricePrefs.map(p => p.user_id);
        }
      }

      // Use the filtered agent IDs
      const { data: preferences, error: prefsError } = await supabase
        .from("notification_preferences")
        .select(`
          user_id,
          ${category}
        `)
        .in("user_id", matchingAgentIds)
        .eq(category, true);

      if (prefsError) {
        console.error("Error fetching filtered preferences:", prefsError);
        throw prefsError;
      }

      if (!preferences || preferences.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "No agents match the specified criteria",
            recipientCount: 0 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Continue with the filtered preferences
      const userIds = preferences.map(p => p.user_id);
      const { data: agents, error: agentsError } = await supabase
        .from("agent_profiles")
        .select("id, email, first_name, last_name")
        .in("id", userIds)
        .not("id", "eq", user.id);

      if (agentsError) {
        console.error("Error fetching agents:", agentsError);
        throw agentsError;
      }

      if (!agents || agents.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "No other agents match the criteria",
            recipientCount: 0 
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Send emails with criteria information
      const emailPromises = agents.map(async (agent) => {
        try {
          let criteriaText = "";
          if (criteria.state) {
            criteriaText += `<strong>State:</strong> ${criteria.state}<br>`;
          }
          if (criteria.city) {
            criteriaText += `<strong>City:</strong> ${criteria.city}<br>`;
          }
          if (criteria.minPrice || criteria.maxPrice) {
            criteriaText += `<strong>Price Range:</strong> `;
            if (criteria.minPrice && criteria.maxPrice) {
              criteriaText += `$${criteria.minPrice.toLocaleString()} - $${criteria.maxPrice.toLocaleString()}`;
            } else if (criteria.minPrice) {
              criteriaText += `$${criteria.minPrice.toLocaleString()}+`;
            } else if (criteria.maxPrice) {
              criteriaText += `Up to $${criteria.maxPrice.toLocaleString()}`;
            }
            criteriaText += `<br>`;
          }

          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
                .message-box { background-color: white; padding: 20px; border-left: 4px solid #2563eb; margin: 20px 0; border-radius: 4px; }
                .criteria-box { background-color: #eff6ff; padding: 15px; border-radius: 4px; margin: 15px 0; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
                .category-badge { display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 10px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0;">New ${getCategoryLabel(category)} Message</h1>
                </div>
                <div class="content">
                  <p>Hi ${agent.first_name},</p>
                  <p>You received a new message from ${senderName}${senderCompany ? ` at ${senderCompany}` : ""}:</p>
                  
                  ${criteriaText ? `
                  <div class="criteria-box">
                    <strong>Client Criteria:</strong><br>
                    ${criteriaText}
                  </div>
                  ` : ""}

                  <div class="message-box">
                    <div class="category-badge">${getCategoryLabel(category)}</div>
                    <h2 style="margin-top: 0; color: #1f2937;">${subject}</h2>
                    <p style="white-space: pre-wrap;">${message}</p>
                  </div>

                  <p style="margin-top: 30px;">
                    <strong>From:</strong> ${senderName}<br>
                    ${senderCompany ? `<strong>Company:</strong> ${senderCompany}<br>` : ""}
                    <strong>Reply to:</strong> <a href="mailto:${senderEmail}">${senderEmail}</a>
                  </p>

                  <div class="footer">
                    <p>You received this email because you have ${getCategoryLabel(category)} notifications enabled${criteriaText ? " and your preferences match the criteria" : ""}.</p>
                    <p>To manage your notification preferences, visit your account settings.</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `;

          const result = await resend.emails.send({
            from: "Agent Network <onboarding@resend.dev>",
            to: [agent.email],
            subject: `${getCategoryLabel(category)}: ${subject}`,
            html: emailHtml,
            reply_to: senderEmail,
          });

          console.log(`Email sent to ${agent.email}:`, result);
          return { success: true, email: agent.email };
        } catch (error) {
          console.error(`Failed to send email to ${agent.email}:`, error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          return { success: false, email: agent.email, error: errorMessage };
        }
      });

      const results = await Promise.all(emailPromises);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`Email sending complete: ${successCount} sent, ${failureCount} failed`);

      return new Response(
        JSON.stringify({
          success: true,
          recipientCount: agents.length,
          successCount,
          failureCount,
          results,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // For other categories (sales_intel, general_discussion), use simple filtering
    const { data: preferences, error: prefsError } = await query;

    if (prefsError) {
      console.error("Error fetching preferences:", prefsError);
      throw prefsError;
    }

    if (!preferences || preferences.length === 0) {
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

    // Get agent profiles for all matching users
    const userIds = preferences.map(p => p.user_id);
    const { data: agents, error: agentsError } = await supabase
      .from("agent_profiles")
      .select("id, email, first_name, last_name")
      .in("id", userIds)
      .not("id", "eq", user.id); // Don't send to self

    if (agentsError) {
      console.error("Error fetching agents:", agentsError);
      throw agentsError;
    }

    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No other agents found to notify",
          recipientCount: 0 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send emails to all matching agents
    const emailPromises = agents.map(async (agent) => {
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
              .message-box { background-color: white; padding: 20px; border-left: 4px solid #2563eb; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }
              .category-badge { display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">New ${getCategoryLabel(category)} Message</h1>
              </div>
              <div class="content">
                <p>Hi ${agent.first_name},</p>
                <p>You received a new message from ${senderName}${senderCompany ? ` at ${senderCompany}` : ""}:</p>
                
                <div class="message-box">
                  <div class="category-badge">${getCategoryLabel(category)}</div>
                  <h2 style="margin-top: 0; color: #1f2937;">${subject}</h2>
                  <p style="white-space: pre-wrap;">${message}</p>
                </div>

                <p style="margin-top: 30px;">
                  <strong>From:</strong> ${senderName}<br>
                  ${senderCompany ? `<strong>Company:</strong> ${senderCompany}<br>` : ""}
                  <strong>Reply to:</strong> <a href="mailto:${senderEmail}">${senderEmail}</a>
                </p>

                <div class="footer">
                  <p>You received this email because you have ${getCategoryLabel(category)} notifications enabled.</p>
                  <p>To manage your notification preferences, visit your account settings.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        const result = await resend.emails.send({
          from: "Agent Network <onboarding@resend.dev>",
          to: [agent.email],
          subject: `${getCategoryLabel(category)}: ${subject}`,
          html: emailHtml,
          reply_to: senderEmail,
        });

        console.log(`Email sent to ${agent.email}:`, result);
        return { success: true, email: agent.email };
      } catch (error) {
        console.error(`Failed to send email to ${agent.email}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return { success: false, email: agent.email, error: errorMessage };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Email sending complete: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        recipientCount: agents.length,
        successCount,
        failureCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-client-need-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    buyer_need: "Buyer Need",
    sales_intel: "Sales Intel",
    renter_need: "Renter Need",
    general_discussion: "General Discussion",
  };
  return labels[category] || category;
}

serve(handler);
