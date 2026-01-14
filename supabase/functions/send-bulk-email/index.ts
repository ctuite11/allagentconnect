import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BulkEmailRequest {
  recipients: Array<{ email: string; name: string }>;
  subject: string;
  message: string;
  agentId: string;
  agentEmail?: string;
  sendAsGroup?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipients, subject, message, agentId, agentEmail, sendAsGroup = false }: BulkEmailRequest = await req.json();

    console.log(`Sending bulk email to ${recipients.length} recipients (group mode: ${sendAsGroup})`);

    if (!recipients || recipients.length === 0) {
      throw new Error("No recipients provided");
    }

    if (!subject || !message) {
      throw new Error("Subject and message are required");
    }

    if (!agentId) {
      throw new Error("Agent ID is required");
    }

    // Create email campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .insert({
        agent_id: agentId,
        subject,
        message,
        recipient_count: recipients.length,
      })
      .select()
      .single();

    if (campaignError) {
      console.error("Error creating campaign:", campaignError);
      throw new Error("Failed to create campaign");
    }

    console.log("Created campaign:", campaign.id);

    // Check if sending as group (for small groups to allow Reply All)
    if (sendAsGroup && recipients.length < 5) {
      console.log("Sending as group email");
      
      // Create tracking pixel URL for the group email
      const { data: emailSend, error: sendError } = await supabase
        .from("email_sends")
        .insert({
          campaign_id: campaign.id,
          recipient_email: recipients[0].email, // Primary recipient for tracking
          recipient_name: "Group Email",
        })
        .select()
        .single();

      if (sendError) {
        console.error("Error creating email send record:", sendError);
        throw sendError;
      }

      const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email-open?id=${emailSend.id}`;
      
      // Replace URLs in message with tracked links
      const trackedMessage = message.replace(
        /(https?:\/\/[^\s<>"]+)/g,
        `${supabaseUrl}/functions/v1/track-email-click?id=${emailSend.id}&url=$1`
      );

      // Send single email to all recipients
      const emailResponse = await resend.emails.send({
        from: "All Agent Connect <noreply@mail.allagentconnect.com>",
        replyTo: agentEmail || undefined,
        to: recipients.map(r => r.email),
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                }
                .content {
                  white-space: pre-wrap;
                }
              </style>
            </head>
            <body>
              <div class="content">
                <p>${trackedMessage.replace(/\n/g, '<br>')}</p>
              </div>
              
              <!-- Tracking pixel -->
              <img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
            </body>
          </html>
        `,
      });

      console.log("Group email sent:", emailResponse);

      if (emailResponse.error) {
        await supabase
          .from("email_sends")
          .update({ status: "failed" })
          .eq("id", emailSend.id);
        throw emailResponse.error;
      }

      return new Response(
        JSON.stringify({
          success: true,
          sent: recipients.length,
          failed: 0,
          total: recipients.length,
          mode: "group",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Send emails individually for privacy and better deliverability
    // This ensures recipients don't see each other's addresses (better than BCC)
    // and allows for individual tracking and personalization
    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        // Create email send record first
        const { data: emailSend, error: sendError } = await supabase
          .from("email_sends")
          .insert({
            campaign_id: campaign.id,
            recipient_email: recipient.email,
            recipient_name: recipient.name,
          })
          .select()
          .single();

        if (sendError) {
          console.error("Error creating email send record:", sendError);
          throw sendError;
        }

        // Create tracking pixel URL
        const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email-open?id=${emailSend.id}`;
        
        // Replace URLs in message with tracked links
        const trackedMessage = message.replace(
          /(https?:\/\/[^\s<>"]+)/g,
          `${supabaseUrl}/functions/v1/track-email-click?id=${emailSend.id}&url=$1`
        );

        const emailResponse = await resend.emails.send({
          from: "All Agent Connect <noreply@mail.allagentconnect.com>",
          replyTo: agentEmail || undefined,
          to: [recipient.email],
          subject: subject,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                  }
                  .content {
                    white-space: pre-wrap;
                  }
                </style>
              </head>
              <body>
                <div class="content">
                  <p>Hello ${recipient.name},</p>
                  <p>${trackedMessage.replace(/\n/g, '<br>')}</p>
                </div>
                
                <!-- Tracking pixel -->
                <img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
              </body>
            </html>
          `,
        });

        console.log(`Email sent to ${recipient.email}:`, emailResponse);
        
        // Update status if failed
        if (emailResponse.error) {
          await supabase
            .from("email_sends")
            .update({ status: "failed" })
            .eq("id", emailSend.id);
        }

        return emailResponse;
      })
    );

    // Count successes and failures
    const successes = results.filter((r) => r.status === "fulfilled").length;
    const failures = results.filter((r) => r.status === "rejected").length;

    console.log(`Bulk email results: ${successes} successes, ${failures} failures`);

    if (failures > 0) {
      const failedEmails = results
        .map((r, i) => (r.status === "rejected" ? recipients[i].email : null))
        .filter(Boolean);
      
      console.error("Failed emails:", failedEmails);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successes,
        failed: failures,
        total: recipients.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-bulk-email function:", error);
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
