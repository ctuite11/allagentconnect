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

    const { category, subject, message }: SendNotificationRequest = await req.json();

    console.log(`Sending ${category} notification from user ${user.id}`);

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
    const { data: preferences, error: prefsError } = await supabase
      .from("notification_preferences")
      .select(`
        user_id,
        ${category}
      `)
      .eq(category, true);

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
